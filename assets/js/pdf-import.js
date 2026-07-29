/* Trip PDF import — text extraction and itinerary heuristics.
 *
 * Lives on its own so the admin page and the test harness share one copy.
 * Loads as a plain <script> in the browser (attaches window.TripPdfImport)
 * and is also require-able from Node for testing.
 *
 * None of this "understands" a document. It reconstructs visual lines from
 * positioned PDF text, then pattern-matches day headings and times. Output
 * is always meant to be reviewed by a human before it's saved.
 */
(function (root) {
  'use strict';

  // A time is H:MM (meridiem optional) or H followed by AM/PM. Requiring one
  // of those two shapes keeps bare numbers like "1933" or "24 taps" out.
  var TIME_CORE = '(?:\\d{1,2}:\\d{2}\\s*(?:[AaPp]\\.?[Mm]\\.?)?|\\d{1,2}\\s*[AaPp]\\.?[Mm]\\.?)';
  var TIME_RANGE_RE = new RegExp('^(' + TIME_CORE + ')\\s*[-–—]\\s*(' + TIME_CORE + ')\\s*[:|]?\\s*(.*)$');
  var TIME_SINGLE_RE = new RegExp('^(' + TIME_CORE + ')\\s*[-–—:|]?\\s*(.*)$');

  var WEEKDAY_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i;
  var DAY_N_RE = /^Day\s+\d+\b/i;
  var MONTH_RE = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}/i;

  // Lines that are section furniture, not a trip title or a route.
  var SECTION_RE = /^(tonight|dinner|the show|the afternoon|the morning|the evening|late night|while you|prep|provisions|arrival|breakfast|lunch|staff|guests?|coffee|pizza|eats|beer|local tip|until|open)\b/i;

  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---- line reconstruction ------------------------------------------- */

  // pdf.js gives us positioned text fragments; group them into visual rows
  // (same baseline within a few px), left-to-right, top-to-bottom.
  async function extractPdfLines(file, pdfjs) {
    var lib = pdfjs || root.pdfjsLib;
    if (!lib) throw new Error('pdf.js is not loaded');
    var data = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    var pdf = await lib.getDocument({ data: data }).promise;
    var lines = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var items = content.items
        .filter(function (it) { return it.str && it.str.trim(); })
        .map(function (it) {
          return { text: it.str, x: it.transform[4], y: it.transform[5], size: Math.abs(it.transform[0]) || 10 };
        });
      items.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
      var row = [], rowY = null;
      var flush = function () {
        if (!row.length) return;
        row.sort(function (a, b) { return a.x - b.x; });
        lines.push({
          text: row.map(function (r) { return r.text; }).join(' ').replace(/\s+/g, ' ').trim(),
          size: row.reduce(function (s, r) { return s + r.size; }, 0) / row.length,
          page: p
        });
        row = [];
      };
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (rowY === null || Math.abs(it.y - rowY) < 3) {
          row.push(it);
          if (rowY === null) rowY = it.y;
        } else {
          flush(); row.push(it); rowY = it.y;
        }
      }
      flush();
    }
    return lines.filter(function (l) { return l.text; });
  }

  /* ---- time helpers -------------------------------------------------- */

  // Position of an hour within a 12-hour half: 12 comes first, then 1..11.
  // Lets us tell "11:30-12:30pm" (11:30 is AM) from "1:30-4:30pm" (both PM).
  function halfIndex(hour) { return hour % 12; }

  // "7:30" borrowing AM from a range end "8:30am" -> "7:30 AM".
  // If the range crosses noon the start belongs to the *other* half, so
  // "9:30-12:30pm" has to come out as 9:30 AM, not 9:30 PM.
  function normalizeTime(start, end) {
    var s = String(start).replace(/\s+/g, '').replace(/\./g, '').toUpperCase();
    if (/(AM|PM)$/.test(s)) return s.replace(/(AM|PM)$/, ' $1');
    if (!end) return s;

    var endStr = String(end).toUpperCase().replace(/\./g, '').replace(/\s+/g, '');
    var endMer = endStr.match(/(AM|PM)/);
    if (!endMer) return s;

    var startHour = parseInt(s, 10);
    var endHour = parseInt(endStr, 10);
    var mer = endMer[1];
    if (!isNaN(startHour) && !isNaN(endHour) && halfIndex(startHour) > halfIndex(endHour)) {
      mer = mer === 'PM' ? 'AM' : 'PM';
    }
    return s + ' ' + mer;
  }

  // Guards a bare time against pairing with page furniture (running headers,
  // all-caps section labels) when we look ahead for its description.
  function looksLikeDescription(t) {
    if (!t || t.length < 5) return false;
    if (SECTION_RE.test(t)) return false;
    if (!/[a-z]/.test(t)) return false; // all-caps banner or spaced-out logotype
    return true;
  }

  function matchTime(text) {
    var r = text.match(TIME_RANGE_RE);
    if (r) return { time: normalizeTime(r[1], r[2]), rest: (r[3] || '').trim() };
    var s = text.match(TIME_SINGLE_RE);
    if (s) return { time: normalizeTime(s[1], null), rest: (s[2] || '').trim() };
    return null;
  }

  /* ---- date guessing ------------------------------------------------- */

  function guessSortDate(lines, dateText) {
    var all = lines.map(function (l) { return l.text; }).join(' ');
    var yearMatch = all.match(/\b(20\d{2})\b/);
    var year = yearMatch ? yearMatch[1] : null;
    if (!year) return '';

    // Strip the year first, so "MAY 2026" can't yield day 20 out of "2026".
    var source = dateText || all;
    var stripped = source.split(year).join(' ');
    var named = stripped.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i);
    if (named) {
      var mo = MONTHS[named[1].slice(0, 3).toLowerCase()];
      var d = parseInt(named[2], 10);
      if (mo && d >= 1 && d <= 31) return year + '-' + pad(mo) + '-' + pad(d);
    }

    // Fall back to the first numeric M/D anywhere (run-of-show docs use these).
    for (var i = 0; i < lines.length; i++) {
      var nm = lines[i].text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
      if (nm) {
        var m2 = parseInt(nm[1], 10), d2 = parseInt(nm[2], 10);
        if (m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31) return year + '-' + pad(m2) + '-' + pad(d2);
      }
    }
    return '';
  }

  /* ---- main heuristic ------------------------------------------------ */

  function isDayHeading(t) {
    return WEEKDAY_RE.test(t) || DAY_N_RE.test(t);
  }

  function guessFromLines(lines) {
    var top = lines.slice(0, 30);

    var titleLine = top.filter(function (l) {
      var t = l.text;
      return t.length > 6 && t.length < 90 && /[a-zA-Z]/.test(t) &&
        !isDayHeading(t) && !SECTION_RE.test(t) && !MONTH_RE.test(t) && !/^\d/.test(t);
    }).sort(function (a, b) { return b.size - a.size; })[0];

    var dateLine = top.filter(function (l) { return MONTH_RE.test(l.text); })
      .sort(function (a, b) { return a.text.length - b.text.length; })[0];

    var routeLine = top.filter(function (l) {
      var t = l.text;
      if (t.length > 90 || /[.!?]$/.test(t)) return false;
      if (isDayHeading(t) || SECTION_RE.test(t)) return false;
      if (titleLine && t === titleLine.text) return false;
      return /[→>•·]|->/.test(t) || (t.match(/,/g) || []).length >= 2;
    })[0];

    var days = [];
    var current = null;
    var pendingTime = null;

    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].text;

      if (isDayHeading(t)) {
        current = { heading: t, sub: '', entryLines: [] };
        days.push(current);
        pendingTime = null;
        continue;
      }

      var tm = matchTime(t);
      if (tm && current) {
        if (tm.rest) {
          current.entryLines.push(tm.time + ' | ' + tm.rest);
          pendingTime = null;
        } else {
          // A time sitting alone on its own row; the description is usually
          // the next line over (common in designed itinerary layouts).
          pendingTime = tm.time;
        }
        continue;
      }

      if (current && pendingTime) {
        if (looksLikeDescription(t)) {
          current.entryLines.push(pendingTime + ' | ' + t);
          pendingTime = null;
          continue;
        }
        // Not a usable description; keep the time on its own rather than
        // gluing a page header onto it.
        current.entryLines.push(pendingTime);
        pendingTime = null;
      }

      if (current && !current.sub && !current.entryLines.length && t !== current.heading && t.length < 140) {
        current.sub = t;
      }
    }

    var themeKeywords = {
      Lake: /\blake\b/i,
      Golf: /\bgolf\b/i,
      'Craft beer': /\b(brewery|brewing|taproom|craft taps?)\b/i,
      Sailing: /\b(sail|sailing|marina|charter|mooring)\b/i,
      Music: /\b(concert|amphitheater|theater|festival|setlist|soundcheck)\b/i,
      'Road trip': /\b(road trip|interstate|I-\d+|US-\d+)\b/i,
      Skiing: /\b(ski|snowboard|slopes)\b/i,
      Vegas: /\b(vegas|sphere)\b/i,
      Islands: /\b(island|snorkel|beach bar)\b/i
    };
    var allText = lines.map(function (l) { return l.text; }).join(' ');

    return {
      title: titleLine ? titleLine.text : '',
      dates: dateLine ? dateLine.text.trim() : '',
      sortdate: guessSortDate(lines, dateLine ? dateLine.text : null),
      route: routeLine ? routeLine.text.trim() : '',
      days: days.filter(function (d) { return d.entryLines.length; }),
      themes: Object.keys(themeKeywords).filter(function (k) { return themeKeywords[k].test(allText); })
    };
  }

  function daysToItineraryText(days) {
    return days.map(function (d) {
      var head = '## ' + d.heading + (d.sub ? ' | ' + d.sub : '');
      return [head].concat(d.entryLines).join('\n');
    }).join('\n\n');
  }

  var api = {
    extractPdfLines: extractPdfLines,
    guessFromLines: guessFromLines,
    daysToItineraryText: daysToItineraryText
  };

  root.TripPdfImport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
