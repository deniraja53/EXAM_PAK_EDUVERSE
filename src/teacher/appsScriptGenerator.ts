export interface SheetSchemaDefinition {
  sheetName: string;
  headers: string[];
  idColumn: string;
  description: string;
}

export const APPS_SCRIPT_SHEET_SCHEMAS: SheetSchemaDefinition[] = [
  {
    sheetName: 'KONFIGURASI',
    headers: ['key', 'value', 'updatedAt', 'notes'],
    idColumn: 'key',
    description: 'Metadata spreadsheet, Spreadsheet ID, dan konfigurasi ujian aktif.',
  },
  {
    sheetName: 'BANK_SOAL',
    headers: [
      'questionId',
      'questionType',
      'questionText',
      'options',
      'correctAnswer',
      'explanation',
      'imageUrl',
      'imageFileId',
      'sourceDocument',
      'createdAt',
      'updatedAt',
      'originalNumber',
    ],
    idColumn: 'questionId',
    description: 'Bank soal pusat, tipe soal, opsi, kunci jawaban, dan metadata gambar.',
  },
  {
    sheetName: 'DISTRIBUSI_SOAL',
    headers: [
      'distributionId',
      'levelId',
      'boxId',
      'questionId',
      'orderIndex',
      'updatedAt',
    ],
    idColumn: 'distributionId',
    description: 'Pemetaan soal ke Question Box Stage 1 (level-01) dan Stage 2 (level-02).',
  },
  {
    sheetName: 'DATA_SISWA',
    headers: ['studentId', 'studentName', 'className', 'createdAt', 'updatedAt'],
    idColumn: 'studentId',
    description: 'Identitas siswa peserta evaluasi.',
  },
  {
    sheetName: 'JAWABAN_SISWA',
    headers: [
      'answerId',
      'sessionId',
      'studentId',
      'levelId',
      'boxId',
      'questionId',
      'studentAnswer',
      'isCorrect',
      'answeredAt',
    ],
    idColumn: 'answerId',
    description: 'Log jawaban siswa per Question Box dan ketepatannya.',
  },
  {
    sheetName: 'HASIL_UJIAN',
    headers: [
      'resultId',
      'sessionId',
      'studentId',
      'studentName',
      'className',
      'totalQuestions',
      'correctCount',
      'incorrectCount',
      'score',
      'startedAt',
      'completedAt',
    ],
    idColumn: 'resultId',
    description: 'Rekap skor akhir sesi ujian siswa.',
  },
  {
    sheetName: 'LOG_AKTIVITAS',
    headers: ['logId', 'timestamp', 'actorRole', 'action', 'details'],
    idColumn: 'logId',
    description: 'Catatan aktivitas sistem, setup, dan sinkronisasi.',
  },
  {
    sheetName: 'BACKUP_DATA',
    headers: ['DATASET', 'ID', 'TYPE', 'DATA', 'UPDATED_AT'],
    idColumn: 'ID',
    description: 'Sheet tabel cadangan universal format TSV EXAM EDUVERSE (paste A1 dari COPY BACKUP).',
  },
];

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * EXAM EDUVERSE - Google Sheets Setup
 */

var SCHEMA_VERSION = '1.1';

var SHEET_DEFINITIONS = [
  {
    name: 'KONFIGURASI',
    idColumn: 'key',
    headers: ['key', 'value', 'updatedAt', 'notes']
  },
  {
    name: 'BANK_SOAL',
    idColumn: 'questionId',
    headers: [
      'questionId',
      'questionType',
      'questionText',
      'options',
      'correctAnswer',
      'explanation',
      'imageUrl',
      'imageFileId',
      'sourceDocument',
      'createdAt',
      'updatedAt',
      'originalNumber'
    ]
  },
  {
    name: 'DISTRIBUSI_SOAL',
    idColumn: 'distributionId',
    headers: [
      'distributionId',
      'levelId',
      'boxId',
      'questionId',
      'orderIndex',
      'updatedAt'
    ]
  },
  {
    name: 'DATA_SISWA',
    idColumn: 'studentId',
    headers: ['studentId', 'studentName', 'className', 'createdAt', 'updatedAt']
  },
  {
    name: 'JAWABAN_SISWA',
    idColumn: 'answerId',
    headers: [
      'answerId',
      'sessionId',
      'studentId',
      'levelId',
      'boxId',
      'questionId',
      'studentAnswer',
      'isCorrect',
      'answeredAt'
    ]
  },
  {
    name: 'HASIL_UJIAN',
    idColumn: 'resultId',
    headers: [
      'resultId',
      'sessionId',
      'studentId',
      'studentName',
      'className',
      'totalQuestions',
      'correctCount',
      'incorrectCount',
      'score',
      'startedAt',
      'completedAt'
    ]
  },
  {
    name: 'LOG_AKTIVITAS',
    idColumn: 'logId',
    headers: ['logId', 'timestamp', 'actorRole', 'action', 'details']
  },
  {
    name: 'BACKUP_DATA',
    idColumn: 'ID',
    headers: ['DATASET', 'ID', 'TYPE', 'DATA', 'UPDATED_AT']
  }
];

function setupExamEduverse(optionalSpreadsheetId) {
  var ss = getTargetSpreadsheet_(optionalSpreadsheetId);
  var sheetResult = createAllSheets(ss);
  var headerResult = createHeaders(ss);
  var configResult = initializeConfiguration(ss);

  appendActivityLog_(
    ss,
    'teacher',
    'setup_exam_eduverse',
    'Setup selesai untuk Spreadsheet "' + ss.getName() + '" (ID: ' + ss.getId() + '). Sheet baru: ' + sheetResult.createdSheets.length + ', sheet tersedia: ' + sheetResult.existingSheets.length + '.'
  );

  var infoMessage =
    'Setup EXAM EDUVERSE berhasil!\\n\\n' +
    'Spreadsheet: ' + ss.getName() + '\\n' +
    'Spreadsheet ID: ' + ss.getId() + '\\n' +
    'Total Sheet: ' + SHEET_DEFINITIONS.length + ' sheet\\n' +
    'Sheet Baru: ' + (sheetResult.createdSheets.length > 0 ? sheetResult.createdSheets.join(', ') : 'Tidak ada (semua sudah tersedia)') + '\\n' +
    'Data lama pada sheet yang sudah ada tetap aman.';

  if (!optionalSpreadsheetId) {
    notifyTeacher_(ss, 'Setup EXAM EDUVERSE Berhasil', infoMessage);
  }

  return {
    success: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    createdSheets: sheetResult.createdSheets,
    existingSheets: sheetResult.existingSheets,
    headersUpdated: headerResult.updatedSheets,
    configKeysEnsured: configResult.ensuredKeys,
    timestamp: getIsoTimestamp_()
  };
}

function testConnection(optionalSpreadsheetId) {
  var ss = getTargetSpreadsheet_(optionalSpreadsheetId);
  var sheets = ss.getSheets();
  var availableSheets = [];
  for (var i = 0; i < sheets.length; i++) {
    availableSheets.push(sheets[i].getName());
  }

  var missingSheets = [];
  for (var j = 0; j < SHEET_DEFINITIONS.length; j++) {
    var requiredName = SHEET_DEFINITIONS[j].name;
    if (availableSheets.indexOf(requiredName) === -1) {
      missingSheets.push(requiredName);
    }
  }

  var summaryText =
    'Terhubung ke "' + ss.getName() + '" (ID: ' + ss.getId() + '). ' +
    'Sheet EXAM EDUVERSE siap: ' + (SHEET_DEFINITIONS.length - missingSheets.length) + '/' + SHEET_DEFINITIONS.length + '.';
  Logger.log(summaryText);

  return {
    success: true,
    ok: true,
    action: 'ping',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    availableSheets: availableSheets,
    missingSheets: missingSheets,
    message: summaryText,
    timestamp: getIsoTimestamp_()
  };
}

function createAllSheets(optionalSs) {
  var ss = optionalSs || getTargetSpreadsheet_();
  var createdSheets = [];
  var existingSheets = [];

  for (var i = 0; i < SHEET_DEFINITIONS.length; i++) {
    var def = SHEET_DEFINITIONS[i];
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      ss.insertSheet(def.name);
      createdSheets.push(def.name);
    } else {
      existingSheets.push(def.name);
    }
  }

  return {
    createdSheets: createdSheets,
    existingSheets: existingSheets
  };
}

function createHeaders(optionalSs) {
  var ss = optionalSs || getTargetSpreadsheet_();
  var updatedSheets = [];

  for (var i = 0; i < SHEET_DEFINITIONS.length; i++) {
    var def = SHEET_DEFINITIONS[i];
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }

    var changed = ensureSheetHeadersSafe_(sheet, def.headers);
    var colCount = Math.max(def.headers.length, sheet.getLastColumn());
    formatSheetHeaderSafe_(sheet, colCount);
    if (changed) {
      updatedSheets.push(def.name);
    }
  }

  return {
    updatedSheets: updatedSheets
  };
}

function initializeConfiguration(optionalSs) {
  var ss = optionalSs || getTargetSpreadsheet_();
  var sheet = ss.getSheetByName('KONFIGURASI');
  if (!sheet) {
    sheet = ss.insertSheet('KONFIGURASI');
  }

  var configDef = SHEET_DEFINITIONS[0];
  ensureSheetHeadersSafe_(sheet, configDef.headers);

  var now = getIsoTimestamp_();
  var spreadsheetId = ss.getId();
  var spreadsheetName = ss.getName();

  var defaults = [
    {
      key: 'spreadsheetId',
      value: spreadsheetId,
      notes: 'ID Google Spreadsheet backup EXAM EDUVERSE',
      alwaysRefresh: true
    },
    {
      key: 'spreadsheetName',
      value: spreadsheetName,
      notes: 'Nama Google Spreadsheet backup',
      alwaysRefresh: true
    },
    {
      key: 'schemaVersion',
      value: SCHEMA_VERSION,
      notes: 'Versi struktur 8 sheet EXAM EDUVERSE',
      alwaysRefresh: true
    },
    {
      key: 'examId',
      value: 'exam-level-01',
      notes: 'ID konfigurasi ujian utama',
      alwaysRefresh: false
    },
    {
      key: 'title',
      value: 'Evaluasi EXAM EDUVERSE (Stage 1 & Stage 2)',
      notes: 'Judul evaluasi aktif',
      alwaysRefresh: false
    },
    {
      key: 'levelId',
      value: 'level-01',
      notes: 'Stage awal permainan',
      alwaysRefresh: false
    },
    {
      key: 'allowRepeatQuestions',
      value: 'false',
      notes: 'Pengulangan soal saat jumlah soal kurang',
      alwaysRefresh: false
    },
    {
      key: 'lastSetupAt',
      value: now,
      notes: 'Waktu terakhir setupExamEduverse dijalankan',
      alwaysRefresh: true
    }
  ];

  var ensuredKeys = [];
  for (var i = 0; i < defaults.length; i++) {
    var item = defaults[i];
    upsertConfigRowSafe_(sheet, item.key, item.value, now, item.notes, item.alwaysRefresh);
    ensuredKeys.push(item.key);
  }

  formatSheetHeaderSafe_(sheet, Math.max(configDef.headers.length, sheet.getLastColumn()));

  return {
    spreadsheetId: spreadsheetId,
    ensuredKeys: ensuredKeys
  };
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('EXAM EDUVERSE')
      .addItem('Setup 8 Sheet Backup', 'setupExamEduverse')
      .addItem('Uji Koneksi Sheet', 'testConnection')
      .addToUi();
  } catch (err) {
    Logger.log('Menu onOpen dilewati: ' + err);
  }
}

function getTargetSpreadsheet_(optionalSpreadsheetId) {
  if (optionalSpreadsheetId && String(optionalSpreadsheetId).trim()) {
    return SpreadsheetApp.openById(String(optionalSpreadsheetId).trim());
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Spreadsheet aktif tidak ditemukan. Buka Apps Script dari Google Spreadsheet.');
  }
  return active;
}

function ensureSheetHeadersSafe_(sheet, expectedHeaders) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return true;
  }

  var existingRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var normalizedExisting = [];
  for (var i = 0; i < existingRow.length; i++) {
    normalizedExisting.push(String(existingRow[i] || '').trim());
  }

  var missingHeaders = [];
  for (var j = 0; j < expectedHeaders.length; j++) {
    var targetHeader = expectedHeaders[j];
    if (normalizedExisting.indexOf(targetHeader) === -1) {
      missingHeaders.push(targetHeader);
    }
  }

  if (missingHeaders.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    return true;
  }

  return false;
}

function formatSheetHeaderSafe_(sheet, columnCount) {
  if (columnCount <= 0) return;

  var headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#f8fafc')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);

  for (var col = 1; col <= columnCount; col++) {
    try {
      sheet.autoResizeColumn(col);
    } catch (resizeErr) {
      Logger.log('autoResizeColumn dilewati pada kolom ' + col + ': ' + resizeErr);
    }
  }
}

function upsertConfigRowSafe_(sheet, key, value, updatedAt, notes, overwriteIfExists) {
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(4, sheet.getLastColumn());
  var headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = [];
  for (var h = 0; h < headerValues.length; h++) {
    headers.push(String(headerValues[h] || '').trim());
  }

  var keyCol = headers.indexOf('key') + 1;
  var valueCol = headers.indexOf('value') + 1;
  var updatedCol = headers.indexOf('updatedAt') + 1;
  var notesCol = headers.indexOf('notes') + 1;
  if (keyCol <= 0) return;

  if (lastRow >= 2) {
    var existingKeys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
    for (var r = 0; r < existingKeys.length; r++) {
      if (String(existingKeys[r][0] || '').trim() === key) {
        if (!overwriteIfExists) {
          return;
        }
        var rowNumber = r + 2;
        if (valueCol > 0) sheet.getRange(rowNumber, valueCol).setValue(value);
        if (updatedCol > 0) sheet.getRange(rowNumber, updatedCol).setValue(updatedAt);
        if (notesCol > 0) sheet.getRange(rowNumber, notesCol).setValue(notes);
        return;
      }
    }
  }

  var newRow = [];
  for (var c = 0; c < lastCol; c++) {
    newRow.push('');
  }
  if (keyCol > 0) newRow[keyCol - 1] = key;
  if (valueCol > 0) newRow[valueCol - 1] = value;
  if (updatedCol > 0) newRow[updatedCol - 1] = updatedAt;
  if (notesCol > 0) newRow[notesCol - 1] = notes;
  sheet.appendRow(newRow);
}

function appendActivityLog_(ss, actorRole, action, details) {
  var sheet = ss.getSheetByName('LOG_AKTIVITAS');
  if (!sheet) return;
  var logHeaders = ['logId', 'timestamp', 'actorRole', 'action', 'details'];
  for (var i = 0; i < SHEET_DEFINITIONS.length; i++) {
    if (SHEET_DEFINITIONS[i].name === 'LOG_AKTIVITAS') {
      logHeaders = SHEET_DEFINITIONS[i].headers;
      break;
    }
  }
  ensureSheetHeadersSafe_(sheet, logHeaders);
  var now = getIsoTimestamp_();
  var logId = 'log-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
  sheet.appendRow([logId, now, actorRole, action, details]);
}

function getIsoTimestamp_() {
  var d = new Date();
  if (typeof d.toISOString === 'function') {
    return d.toISOString();
  }
  return String(d);
}

function notifyTeacher_(ss, title, message) {
  Logger.log(title + ': ' + message);
  try {
    ss.toast(message.replace(/\\n+/g, ' | '), title, 8);
  } catch (toastErr) {
    Logger.log('Toast dilewati: ' + toastErr);
  }
  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert(title, message, ui.ButtonSet.OK);
  } catch (alertErr) {
    Logger.log('UI alert dilewati: ' + alertErr);
  }
}

function readSheetObjects_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol <= 0) return [];

  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = [];
  for (var h = 0; h < rawHeaders.length; h++) {
    headers.push(String(rawHeaders[h] || '').trim());
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var results = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var hasAnyValue = false;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var colName = headers[c];
      if (!colName) continue;
      var cellVal = row[c];
      if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
        hasAnyValue = true;
      }
      obj[colName] = cellVal;
    }
    if (hasAnyValue) {
      results.push(obj);
    }
  }
  return results;
}

function getQuestions(optionalSpreadsheetId) {
  var ss = getTargetSpreadsheet_(optionalSpreadsheetId);
  var items = readSheetObjects_(ss, 'BANK_SOAL');
  return {
    success: true,
    action: 'getQuestions',
    count: items.length,
    questions: items,
    errors: [],
    timestamp: getIsoTimestamp_()
  };
}

function getDistribution(optionalSpreadsheetId) {
  var ss = getTargetSpreadsheet_(optionalSpreadsheetId);
  var items = readSheetObjects_(ss, 'DISTRIBUSI_SOAL');
  return {
    success: true,
    action: 'getDistribution',
    count: items.length,
    distribution: items,
    errors: [],
    timestamp: getIsoTimestamp_()
  };
}

function getExamResults(optionalSpreadsheetId) {
  var ss = getTargetSpreadsheet_(optionalSpreadsheetId);
  var items = readSheetObjects_(ss, 'HASIL_UJIAN');
  return {
    success: true,
    action: 'getExamResults',
    count: items.length,
    results: items,
    errors: [],
    timestamp: getIsoTimestamp_()
  };
}

function getBackupData(optionalSpreadsheetId) {
  var ss = getTargetSpreadsheet_(optionalSpreadsheetId);
  var rows = readSheetObjects_(ss, 'BACKUP_DATA');
  return {
    success: true,
    action: 'getBackupData',
    count: rows.length,
    backupRows: rows,
    errors: [],
    timestamp: getIsoTimestamp_()
  };
}

function readAllSheetsSnapshot(optionalSpreadsheetId) {
  var ss = getTargetSpreadsheet_(optionalSpreadsheetId);
  return {
    success: true,
    action: 'readAll',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    data: {
      KONFIGURASI: readSheetObjects_(ss, 'KONFIGURASI'),
      BANK_SOAL: readSheetObjects_(ss, 'BANK_SOAL'),
      DISTRIBUSI_SOAL: readSheetObjects_(ss, 'DISTRIBUSI_SOAL'),
      DATA_SISWA: readSheetObjects_(ss, 'DATA_SISWA'),
      JAWABAN_SISWA: readSheetObjects_(ss, 'JAWABAN_SISWA'),
      HASIL_UJIAN: readSheetObjects_(ss, 'HASIL_UJIAN'),
      LOG_AKTIVITAS: readSheetObjects_(ss, 'LOG_AKTIVITAS'),
      BACKUP_DATA: readSheetObjects_(ss, 'BACKUP_DATA')
    },
    timestamp: getIsoTimestamp_()
  };
}

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = String(params.action || 'ping').trim();
    var spreadsheetId = String(params.spreadsheetId || '').trim();

    if (action === 'ping') {
      return jsonResponse_(testConnection(spreadsheetId));
    }
    if (action === 'initializeSheets') {
      return jsonResponse_(setupExamEduverse(spreadsheetId));
    }
    if (action === 'getQuestions') {
      return jsonResponse_(getQuestions(spreadsheetId));
    }
    if (action === 'getDistribution') {
      return jsonResponse_(getDistribution(spreadsheetId));
    }
    if (action === 'getExamResults') {
      return jsonResponse_(getExamResults(spreadsheetId));
    }
    if (action === 'getBackupData') {
      return jsonResponse_(getBackupData(spreadsheetId));
    }
    if (action === 'readAll') {
      return jsonResponse_(readAllSheetsSnapshot(spreadsheetId));
    }

    return jsonResponse_({
      success: false,
      action: action,
      errors: ['Aksi GET tidak dikenali: ' + action]
    });
  } catch (err) {
    return jsonResponse_({
      success: false,
      errors: [String(err && err.message ? err.message : err)]
    });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var action = String(payload.action || '').trim();
    var spreadsheetId = String(payload.spreadsheetId || '').trim();
    var ss = getTargetSpreadsheet_(spreadsheetId);
    var items = Array.isArray(payload.data) ? payload.data : (payload.data ? [payload.data] : []);

    if (action === 'ping') {
      return jsonResponse_(testConnection(spreadsheetId));
    }

    if (action === 'initializeSheets') {
      var setupRes = setupExamEduverse(spreadsheetId);
      return jsonResponse_({
        success: true,
        action: action,
        spreadsheetName: setupRes.spreadsheetName,
        spreadsheetId: setupRes.spreadsheetId,
        createdSheets: setupRes.createdSheets,
        existingSheets: setupRes.existingSheets,
        timestamp: getIsoTimestamp_()
      });
    }

    if (action === 'getQuestions') {
      return jsonResponse_(getQuestions(spreadsheetId));
    }
    if (action === 'getDistribution') {
      return jsonResponse_(getDistribution(spreadsheetId));
    }
    if (action === 'getExamResults') {
      return jsonResponse_(getExamResults(spreadsheetId));
    }
    if (action === 'getBackupData') {
      return jsonResponse_(getBackupData(spreadsheetId));
    }
    if (action === 'readAll') {
      return jsonResponse_(readAllSheetsSnapshot(spreadsheetId));
    }

    if (action === 'writeActivityLog') {
      var logItem = payload.data || {};
      appendActivityLog_(
        ss,
        logItem.actorRole || logItem.entityType || 'system',
        logItem.action || 'custom',
        logItem.details || logItem.message || ''
      );
      return jsonResponse_({
        success: true,
        action: action,
        saved: 1,
        updated: 0,
        timestamp: getIsoTimestamp_()
      });
    }

    var sheetMap = {
      saveConfig: 'KONFIGURASI',
      saveQuestions: 'BANK_SOAL',
      saveDistribution: 'DISTRIBUSI_SOAL',
      saveStudent: 'DATA_SISWA',
      saveAnswer: 'JAWABAN_SISWA',
      saveExamResult: 'HASIL_UJIAN',
      saveBackupData: 'BACKUP_DATA'
    };

    var targetSheetName = sheetMap[action];
    if (!targetSheetName) {
      return jsonResponse_({
        success: false,
        action: action,
        errors: ['Aksi POST tidak dikenali: ' + action]
      });
    }

    var targetDef = null;
    for (var i = 0; i < SHEET_DEFINITIONS.length; i++) {
      if (SHEET_DEFINITIONS[i].name === targetSheetName) {
        targetDef = SHEET_DEFINITIONS[i];
        break;
      }
    }

    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
    }
    ensureSheetHeadersSafe_(sheet, targetDef.headers);

    var counts = upsertRowsById_(sheet, targetDef.headers, targetDef.idColumn, items);
    return jsonResponse_({
      success: true,
      action: action,
      saved: counts.saved,
      updated: counts.updated,
      spreadsheetName: ss.getName(),
      spreadsheetId: ss.getId(),
      timestamp: getIsoTimestamp_()
    });
  } catch (err) {
    return jsonResponse_({
      success: false,
      errors: [String(err && err.message ? err.message : err)]
    });
  }
}

function upsertRowsById_(sheet, headers, idColumn, rows) {
  var saved = 0;
  var updated = 0;
  var lastCol = Math.max(headers.length, sheet.getLastColumn());
  var activeHeaders = headers.slice();
  if (sheet.getLastRow() >= 1 && lastCol > 0) {
    var row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var resolved = [];
    for (var hc = 0; hc < row1.length; hc++) {
      var hText = String(row1[hc] || '').trim();
      if (hText) resolved.push(hText);
    }
    if (resolved.length > 0 && resolved.indexOf(idColumn) >= 0) {
      activeHeaders = resolved;
    }
  }

  var idIdx = activeHeaders.indexOf(idColumn);
  if (idIdx < 0) return { saved: 0, updated: 0 };

  var lastRow = sheet.getLastRow();
  var existingMap = {};
  if (lastRow >= 2) {
    var existingIds = sheet.getRange(2, idIdx + 1, lastRow - 1, 1).getValues();
    for (var r = 0; r < existingIds.length; r++) {
      var idVal = String(existingIds[r][0] || '').trim();
      if (idVal) {
        existingMap[idVal] = r + 2;
      }
    }
  }

  for (var i = 0; i < rows.length; i++) {
    var item = rows[i] || {};
    var recId = String(item[idColumn] || '').trim();
    if (!recId) continue;

    var valuesRow = [];
    for (var h = 0; h < activeHeaders.length; h++) {
      var val = item[activeHeaders[h]];
      valuesRow.push(val === undefined || val === null ? '' : val);
    }

    if (existingMap[recId]) {
      sheet.getRange(existingMap[recId], 1, 1, valuesRow.length).setValues([valuesRow]);
      updated += 1;
    } else {
      sheet.appendRow(valuesRow);
      existingMap[recId] = sheet.getLastRow();
      saved += 1;
    }
  }

  return { saved: saved, updated: updated };
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const STATIC_APPS_SCRIPT_CODE = GOOGLE_APPS_SCRIPT_CODE;

export interface AppsScriptSourceValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates that the generated Code.gs source is strictly pure JavaScript
 * for Google Apps Script (never TSV/table headers, BACKUP_META, KONFIGURASI, JSON backup, or Markdown).
 */
export function validateAppsScriptSourceCode(source: unknown): AppsScriptSourceValidation {
  if (typeof source !== 'string' || !source.trim()) {
    return {
      valid: false,
      error: 'Kode Code.gs masih kosong. Klik "GENERATE CODE.GS" terlebih dahulu.',
    };
  }

  const trimmed = source.trimStart();
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? '';

  if (
    /^(DATASET|ID|TYPE|DATA|UPDATED_AT|BACKUP_META|KONFIGURASI|DISTRIBUSI_STAGE|DISTRIBUSI_MODEL|BANK_SOAL|SISWA|JAWABAN_SISWA|HASIL)(\s|\t|,|$)/i.test(
      trimmed
    )
  ) {
    return {
      valid: false,
      error:
        'Sumber terdeteksi sebagai data/header backup (DATASET/BACKUP_META/KONFIGURASI), bukan kode JavaScript Google Apps Script.',
    };
  }

  if (
    /^[^\n]*\t[^\n]*\t/.test(firstLine) ||
    /\bDATASET\tID\tTYPE\tDATA\tUPDATED_AT\b/i.test(source) ||
    /\bBACKUP_META\t/i.test(source)
  ) {
    return {
      valid: false,
      error: 'Sumber terdeteksi sebagai data TSV tabel backup, bukan kode JavaScript Google Apps Script.',
    };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return {
      valid: false,
      error: 'Sumber terdeteksi sebagai data JSON, bukan kode JavaScript Google Apps Script.',
    };
  }

  if (source.includes('```')) {
    return {
      valid: false,
      error: 'Kode mengandung Markdown code fence (```) yang tidak valid di Google Apps Script.',
    };
  }

  const startsWithJsCommentOrDecl =
    trimmed.startsWith('/**') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('//') ||
    /^(function|var|let|const)\s+[A-Za-z_$]/.test(trimmed);

  if (!startsWithJsCommentOrDecl) {
    return {
      valid: false,
      error: 'Kode harus diawali komentar JavaScript (/** ... */) atau deklarasi function/const/var yang valid.',
    };
  }

  for (const requiredToken of [
    'function setupExamEduverse',
    'function doGet',
    'function doPost',
    'function testConnection',
    'function createAllSheets',
    'BACKUP_DATA',
    'SpreadsheetApp',
  ]) {
    if (!source.includes(requiredToken)) {
      return {
        valid: false,
        error: `Komponen wajib ${requiredToken} tidak ditemukan pada kode Code.gs.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates that backupTSV is strictly TSV backup tabular text and never JavaScript source code.
 */
export function validateBackupTsvSource(tsv: unknown): AppsScriptSourceValidation {
  if (typeof tsv !== 'string' || !tsv.trim()) {
    return {
      valid: false,
      error: 'Data backup TSV masih kosong. Klik "BUAT DATA BACKUP" terlebih dahulu.',
    };
  }

  const trimmed = tsv.trimStart();
  if (
    trimmed.startsWith('/**') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('//') ||
    /^(function|var|let|const)\s+[A-Za-z_$]/.test(trimmed)
  ) {
    return {
      valid: false,
      error: 'Sumber backup terdeteksi sebagai kode JavaScript, bukan data TSV backup.',
    };
  }

  if (!trimmed.startsWith('DATASET\tID\tTYPE\tDATA\tUPDATED_AT')) {
    return {
      valid: false,
      error: 'Header TSV backup harus diawali DATASET\\tID\\tTYPE\\tDATA\\tUPDATED_AT.',
    };
  }

  return { valid: true };
}

export interface GeneratedAppsScriptResult {
  code: string;
  fileName: string;
  sheetCount: number;
  sheetNames: string[];
  generatedAt: string;
}

/**
 * Returns the static, verified Google Apps Script source code (Code.gs).
 * Never derives code from question bank data or backup TSV payloads.
 */
export function generateAppsScriptCode(): GeneratedAppsScriptResult {
  const validation = validateAppsScriptSourceCode(GOOGLE_APPS_SCRIPT_CODE);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Kode Code.gs internal tidak valid.');
  }

  return {
    code: GOOGLE_APPS_SCRIPT_CODE,
    fileName: 'Code.gs',
    sheetCount: APPS_SCRIPT_SHEET_SCHEMAS.length,
    sheetNames: APPS_SCRIPT_SHEET_SCHEMAS.map((s) => s.sheetName),
    generatedAt: new Date().toISOString(),
  };
}
