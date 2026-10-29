/**
 * Receives top-10 submissions from the site and writes them to this sheet.
 *
 * One row per email: resubmitting with the same email updates that row
 * instead of adding a new one.
 *
 * Deploy: Extensions > Apps Script, paste this file, then
 * Deploy > New deployment > Web app, "Execute as: Me", "Who has access: Anyone".
 */

var SHEET_NAME = 'Submissions';
var MAX_PICKS = 10;
var HEADERS = ['Submitted at', 'Email', 'Times submitted']
  .concat(range(MAX_PICKS).map(function (i) { return '#' + (i + 1); }))
  .concat(['Pick IDs']);

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    var email = clean(body.email, 254).toLowerCase();
    var picks = Array.isArray(body.picks) ? body.picks.slice(0, MAX_PICKS) : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'invalid email' });
    if (!picks.length) return json({ ok: false, error: 'missing picks' });

    var sheet = getSheet();
    var labels = picks.map(function (p) {
      var line = clean(p.winner, 60) + ' d. ' + clean(p.loser, 60);
      if (p.score) line += ' ' + clean(p.score, 60);
      var where = [clean(p.event, 60), clean(p.round, 30)].filter(String).join(' ');
      return where ? line + ' (' + where + ')' : line;
    });
    while (labels.length < MAX_PICKS) labels.push('');
    var ids = picks.map(function (p) { return clean(p.id, 80); }).join(', ');

    var existing = findRow(sheet, email);
    var count = existing ? Number(sheet.getRange(existing, 3).getValue() || 0) + 1 : 1;
    var row = [new Date(), email, count].concat(labels).concat([ids]);

    if (existing) {
      sheet.getRange(existing, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return json({ ok: true, updated: !!existing });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  // A tab from an older version of this script has different columns: set it
  // aside rather than mixing the two layouts.
  if (sheet && sheet.getLastRow() > 0 && sheet.getRange(1, 2).getValue() !== HEADERS[1]) {
    sheet.setName(SHEET_NAME + ' (old ' + new Date().toISOString().slice(0, 10) + ')');
    sheet = null;
  }
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var emails = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).toLowerCase() === email) return i + 2;
  }
  return 0;
}

// Strip leading characters that would make Sheets treat text as a formula.
function clean(value, max) {
  return String(value == null ? '' : value).slice(0, max).replace(/^[=+\-@]+/, '').trim();
}

function range(n) {
  var out = [];
  for (var i = 0; i < n; i++) out.push(i);
  return out;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
