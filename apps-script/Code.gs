/**
 * Receives top-10 submissions from the site and writes them to this sheet.
 *
 * One row per browser (keyed by clientId): resubmitting from the same browser
 * updates that row instead of adding a new one.
 *
 * Deploy: Extensions > Apps Script, paste this file, then
 * Deploy > New deployment > Web app, "Execute as: Me", "Who has access: Anyone".
 */

var SHEET_NAME = 'Submissions';
var MAX_PICKS = 10;
var HEADERS = ['Submitted at', 'Name', 'Client ID', 'Times submitted']
  .concat(range(MAX_PICKS).map(function (i) { return '#' + (i + 1); }))
  .concat(['Pick IDs']);

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    var clientId = clean(body.clientId, 64);
    var name = clean(body.name, 80);
    var picks = Array.isArray(body.picks) ? body.picks.slice(0, MAX_PICKS) : [];
    if (!clientId || !picks.length) return json({ ok: false, error: 'missing picks' });

    var sheet = getSheet();
    var labels = picks.map(function (p) {
      var line = clean(p.winner, 60) + ' d. ' + clean(p.loser, 60);
      if (p.score) line += ' ' + clean(p.score, 60);
      var where = [clean(p.event, 60), clean(p.round, 30)].filter(String).join(' ');
      return where ? line + ' (' + where + ')' : line;
    });
    while (labels.length < MAX_PICKS) labels.push('');
    var ids = picks.map(function (p) { return clean(p.id, 80); }).join(', ');

    var existing = findRow(sheet, clientId);
    var count = existing ? Number(sheet.getRange(existing, 4).getValue() || 0) + 1 : 1;
    var row = [new Date(), name, clientId, count].concat(labels).concat([ids]);

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
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow(sheet, clientId) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, 3, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === clientId) return i + 2;
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
