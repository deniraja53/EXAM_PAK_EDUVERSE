/**
 * EXAM EDUVERSE - Google Apps Script Backend Middleware
 * ======================================================
 * File ini siap disalin ke Google Apps Script Editor (script.google.com).
 * Mendukung 7 sheet:
 *   1. KONFIGURASI
 *   2. BANK_SOAL
 *   3. DISTRIBUSI_SOAL
 *   4. DATA_SISWA
 *   5. JAWABAN_SISWA
 *   6. HASIL_UJIAN
 *   7. LOG_AKTIVITAS
 *
 * CATATAN DEPLOYMENT:
 * - Tempelkan seluruh isi file ini ke editor Google Apps Script (Code.gs).
 * - Jika menggunakan standalone script, kirim `spreadsheetId` dari dashboard Mode Guru
 *   atau isi DEFAULT_SPREADSHEET_ID di PropertiesService (Script Properties).
 * - Deploy sebagai Web App: Execute as = "Me", Who has access = "Anyone" (atau domain sekolah).
 */

var SHEET_SCHEMAS = {
  KONFIGURASI: ['key', 'value', 'updatedAt'],
  BANK_SOAL: [
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
  ],
  DISTRIBUSI_SOAL: [
    'distributionId',
    'levelId',
    'boxId',
    'questionId',
    'orderIndex',
    'updatedAt',
  ],
  DATA_SISWA: [
    'studentId',
    'studentName',
    'className',
    'createdAt',
    'updatedAt',
  ],
  JAWABAN_SISWA: [
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
  HASIL_UJIAN: [
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
  LOG_AKTIVITAS: [
    'logId',
    'action',
    'entityType',
    'entityId',
    'status',
    'message',
    'createdAt',
  ],
};

function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTargetSpreadsheet(spreadsheetId) {
  if (spreadsheetId && String(spreadsheetId).trim()) {
    return SpreadsheetApp.openById(String(spreadsheetId).trim());
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }
  var propId = PropertiesService.getScriptProperties().getProperty('DEFAULT_SPREADSHEET_ID');
  if (propId && String(propId).trim()) {
    return SpreadsheetApp.openById(String(propId).trim());
  }
  throw new Error(
    'Spreadsheet tidak ditemukan. Isi Spreadsheet ID pada Mode Guru atau ikat Apps Script ini ke Google Spreadsheet target.'
  );
}

function ensureSheetWithHeaders(ss, sheetName) {
  var headers = SHEET_SCHEMAS[sheetName];
  if (!headers) {
    throw new Error('Skema sheet tidak dikenal: ' + sheetName);
  }
  var sheet = ss.getSheetByName(sheetName);
  var created = false;
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    created = true;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, headers.length)).getValues()[0];
    var mismatch = false;
    for (var i = 0; i < headers.length; i++) {
      if (String(currentHeaders[i] || '').trim() !== headers[i]) {
        mismatch = true;
        break;
      }
    }
    if (mismatch && lastRow === 1 && !String(currentHeaders[0] || '').trim()) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return { sheet: sheet, created: created, headers: headers };
}

/**
 * Menginisialisasi seluruh 7 sheet sesuai skema tanpa menghapus data yang sudah ada.
 */
function initializeSheets(spreadsheetId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Server sedang sibuk memproses antrean lain. Coba lagi sebentar.');
  }
  try {
    var ss = getTargetSpreadsheet(spreadsheetId);
    var createdSheets = [];
    var verifiedSheets = [];
    var names = Object.keys(SHEET_SCHEMAS);

    for (var i = 0; i < names.length; i++) {
      var info = ensureSheetWithHeaders(ss, names[i]);
      if (info.created) {
        createdSheets.push(names[i]);
      } else {
        verifiedSheets.push(names[i]);
      }
    }

    writeActivityLog(
      ss,
      'initializeSheets',
      'SYSTEM',
      ss.getId(),
      'success',
      'Inisialisasi 7 sheet selesai (baru: ' + createdSheets.length + ', ada: ' + verifiedSheets.length + ').'
    );

    return {
      success: true,
      action: 'initializeSheets',
      spreadsheetName: ss.getName(),
      spreadsheetId: ss.getId(),
      createdSheets: createdSheets,
      verifiedSheets: verifiedSheets,
      saved: createdSheets.length,
      updated: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function readSheetObjects(ss, sheetName) {
  var info = ensureSheetWithHeaders(ss, sheetName);
  var sheet = info.sheet;
  var headers = info.headers;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var items = [];
  for (var r = 0; r < values.length; r++) {
    var obj = {};
    var hasValue = false;
    for (var c = 0; c < headers.length; c++) {
      var cellVal = values[r][c];
      if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
        hasValue = true;
      }
      obj[headers[c]] = cellVal;
    }
    if (hasValue) {
      items.push(obj);
    }
  }
  return items;
}

/**
 * Upsert baris berdasarkan kolom ID (kolom indeks 0 = idField).
 * Mencegah duplikasi data ketika ID yang sama disinkronkan ulang.
 */
function upsertRowsById(ss, sheetName, idField, records, preserveCreatedAt) {
  var info = ensureSheetWithHeaders(ss, sheetName);
  var sheet = info.sheet;
  var headers = info.headers;
  var idIndex = headers.indexOf(idField);
  if (idIndex < 0) {
    throw new Error('Kolom ID "' + idField + '" tidak ditemukan pada sheet ' + sheetName);
  }

  var createdAtIndex = headers.indexOf('createdAt');
  var lastRow = sheet.getLastRow();
  var existingRowById = {};
  var existingCreatedAtById = {};

  if (lastRow > 1) {
    var existingIds = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues();
    var existingCreated =
      preserveCreatedAt && createdAtIndex >= 0
        ? sheet.getRange(2, createdAtIndex + 1, lastRow - 1, 1).getValues()
        : null;

    for (var i = 0; i < existingIds.length; i++) {
      var key = String(existingIds[i][0] || '').trim();
      if (key) {
        existingRowById[key] = i + 2;
        if (existingCreated) {
          existingCreatedAtById[key] = existingCreated[i][0];
        }
      }
    }
  }

  var saved = 0;
  var updated = 0;
  var errors = [];
  var rowsToAppend = [];
  var nowIso = new Date().toISOString();

  for (var idx = 0; idx < records.length; idx++) {
    var rec = records[idx];
    if (!rec || typeof rec !== 'object') {
      errors.push('Record ke-' + (idx + 1) + ' tidak valid.');
      continue;
    }
    var recId = String(rec[idField] || '').trim();
    if (!recId) {
      errors.push('Record ke-' + (idx + 1) + ' tidak memiliki ' + idField + '.');
      continue;
    }

    var rowValues = [];
    for (var h = 0; h < headers.length; h++) {
      var col = headers[h];
      var val = rec[col];
      if (col === 'createdAt' && preserveCreatedAt && existingCreatedAtById[recId]) {
        val = existingCreatedAtById[recId];
      } else if ((col === 'createdAt' || col === 'updatedAt') && !val) {
        val = nowIso;
      } else if (val === undefined || val === null) {
        val = '';
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      rowValues.push(val);
    }

    var existingRow = existingRowById[recId];
    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowValues]);
      updated++;
    } else {
      rowsToAppend.push(rowValues);
      existingRowById[recId] = lastRow + rowsToAppend.length + (lastRow === 0 ? 1 : 0);
      saved++;
    }
  }

  if (rowsToAppend.length > 0) {
    var startRow = Math.max(2, sheet.getLastRow() + 1);
    sheet.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }

  return { saved: saved, updated: updated, errors: errors };
}

function getQuestions(spreadsheetId) {
  var ss = getTargetSpreadsheet(spreadsheetId);
  var items = readSheetObjects(ss, 'BANK_SOAL');
  return {
    success: true,
    action: 'getQuestions',
    count: items.length,
    questions: items,
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

function saveQuestions(spreadsheetId, questions, operationId) {
  if (!Array.isArray(questions)) {
    throw new Error('Parameter questions harus berupa array.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Lock sibuk saat menyimpan soal.');
  }
  try {
    var ss = getTargetSpreadsheet(spreadsheetId);
    if (operationId && isOperationAlreadyProcessed(ss, operationId)) {
      return {
        success: true,
        action: 'saveQuestions',
        operationId: operationId,
        saved: 0,
        updated: 0,
        skipped: questions.length,
        deduplicated: true,
        errors: [],
      };
    }

    // Tolak penyimpanan Base64 gambar berukuran besar langsung di sel Google Sheets
    var sanitized = [];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var imgUrl = String(q.imageUrl || '');
      if (imgUrl.indexOf('data:image/') === 0) {
        imgUrl = '';
      }
      sanitized.push({
        questionId: q.questionId,
        questionType: q.questionType || 'pilihan_ganda',
        questionText: q.questionText || '',
        options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
        correctAnswer:
          typeof q.correctAnswer === 'string'
            ? q.correctAnswer
            : JSON.stringify(q.correctAnswer || ''),
        explanation: q.explanation || '',
        imageUrl: imgUrl,
        imageFileId: q.imageFileId || '',
        sourceDocument: q.sourceDocument || '',
        createdAt: q.createdAt || new Date().toISOString(),
        updatedAt: q.updatedAt || new Date().toISOString(),
      });
    }

    var res = upsertRowsById(ss, 'BANK_SOAL', 'questionId', sanitized, true);
    writeActivityLog(
      ss,
      'saveQuestions',
      'BANK_SOAL',
      operationId || 'batch',
      res.errors.length === 0 ? 'success' : 'partial',
      'Saved: ' + res.saved + ', Updated: ' + res.updated,
      operationId
    );

    return {
      success: res.errors.length === 0 || res.saved + res.updated > 0,
      action: 'saveQuestions',
      operationId: operationId || null,
      saved: res.saved,
      updated: res.updated,
      errors: res.errors,
      timestamp: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function getDistribution(spreadsheetId) {
  var ss = getTargetSpreadsheet(spreadsheetId);
  var items = readSheetObjects(ss, 'DISTRIBUSI_SOAL');
  return {
    success: true,
    action: 'getDistribution',
    count: items.length,
    distribution: items,
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

function saveDistribution(spreadsheetId, distributionRows, operationId) {
  if (!Array.isArray(distributionRows)) {
    throw new Error('Parameter distribution harus berupa array.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Lock sibuk saat menyimpan distribusi soal.');
  }
  try {
    var ss = getTargetSpreadsheet(spreadsheetId);
    if (operationId && isOperationAlreadyProcessed(ss, operationId)) {
      return {
        success: true,
        action: 'saveDistribution',
        operationId: operationId,
        saved: 0,
        updated: 0,
        skipped: distributionRows.length,
        deduplicated: true,
        errors: [],
      };
    }

    var res = upsertRowsById(ss, 'DISTRIBUSI_SOAL', 'distributionId', distributionRows, false);
    writeActivityLog(
      ss,
      'saveDistribution',
      'DISTRIBUSI_SOAL',
      operationId || 'batch',
      res.errors.length === 0 ? 'success' : 'partial',
      'Saved: ' + res.saved + ', Updated: ' + res.updated,
      operationId
    );

    return {
      success: res.errors.length === 0 || res.saved + res.updated > 0,
      action: 'saveDistribution',
      operationId: operationId || null,
      saved: res.saved,
      updated: res.updated,
      errors: res.errors,
      timestamp: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function saveStudent(spreadsheetId, studentOrList, operationId) {
  var list = Array.isArray(studentOrList) ? studentOrList : [studentOrList];
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Lock sibuk saat menyimpan data siswa.');
  }
  try {
    var ss = getTargetSpreadsheet(spreadsheetId);
    if (operationId && isOperationAlreadyProcessed(ss, operationId)) {
      return {
        success: true,
        action: 'saveStudent',
        operationId: operationId,
        saved: 0,
        updated: 0,
        skipped: list.length,
        deduplicated: true,
        errors: [],
      };
    }

    var res = upsertRowsById(ss, 'DATA_SISWA', 'studentId', list, true);
    writeActivityLog(
      ss,
      'saveStudent',
      'DATA_SISWA',
      operationId || (list[0] && list[0].studentId) || 'batch',
      res.errors.length === 0 ? 'success' : 'partial',
      'Saved: ' + res.saved + ', Updated: ' + res.updated,
      operationId
    );

    return {
      success: res.errors.length === 0 || res.saved + res.updated > 0,
      action: 'saveStudent',
      operationId: operationId || null,
      saved: res.saved,
      updated: res.updated,
      errors: res.errors,
      timestamp: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function saveAnswer(spreadsheetId, answerOrList, operationId) {
  var list = Array.isArray(answerOrList) ? answerOrList : [answerOrList];
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Lock sibuk saat menyimpan jawaban siswa.');
  }
  try {
    var ss = getTargetSpreadsheet(spreadsheetId);
    if (operationId && isOperationAlreadyProcessed(ss, operationId)) {
      return {
        success: true,
        action: 'saveAnswer',
        operationId: operationId,
        saved: 0,
        updated: 0,
        skipped: list.length,
        deduplicated: true,
        errors: [],
      };
    }

    var res = upsertRowsById(ss, 'JAWABAN_SISWA', 'answerId', list, false);
    writeActivityLog(
      ss,
      'saveAnswer',
      'JAWABAN_SISWA',
      operationId || (list[0] && list[0].answerId) || 'batch',
      res.errors.length === 0 ? 'success' : 'partial',
      'Saved: ' + res.saved + ', Updated: ' + res.updated,
      operationId
    );

    return {
      success: res.errors.length === 0 || res.saved + res.updated > 0,
      action: 'saveAnswer',
      operationId: operationId || null,
      saved: res.saved,
      updated: res.updated,
      errors: res.errors,
      timestamp: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function saveExamResult(spreadsheetId, resultOrList, operationId) {
  var list = Array.isArray(resultOrList) ? resultOrList : [resultOrList];
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Lock sibuk saat menyimpan hasil ujian.');
  }
  try {
    var ss = getTargetSpreadsheet(spreadsheetId);
    if (operationId && isOperationAlreadyProcessed(ss, operationId)) {
      return {
        success: true,
        action: 'saveExamResult',
        operationId: operationId,
        saved: 0,
        updated: 0,
        skipped: list.length,
        deduplicated: true,
        errors: [],
      };
    }

    var res = upsertRowsById(ss, 'HASIL_UJIAN', 'resultId', list, false);
    writeActivityLog(
      ss,
      'saveExamResult',
      'HASIL_UJIAN',
      operationId || (list[0] && list[0].resultId) || 'batch',
      res.errors.length === 0 ? 'success' : 'partial',
      'Saved: ' + res.saved + ', Updated: ' + res.updated,
      operationId
    );

    return {
      success: res.errors.length === 0 || res.saved + res.updated > 0,
      action: 'saveExamResult',
      operationId: operationId || null,
      saved: res.saved,
      updated: res.updated,
      errors: res.errors,
      timestamp: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function getExamResults(spreadsheetId) {
  var ss = getTargetSpreadsheet(spreadsheetId);
  var items = readSheetObjects(ss, 'HASIL_UJIAN');
  return {
    success: true,
    action: 'getExamResults',
    count: items.length,
    results: items,
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

function saveConfigRows(spreadsheetId, configRows, operationId) {
  if (!Array.isArray(configRows)) {
    throw new Error('Parameter configRows harus berupa array.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Lock sibuk saat menyimpan konfigurasi.');
  }
  try {
    var ss = getTargetSpreadsheet(spreadsheetId);
    var res = upsertRowsById(ss, 'KONFIGURASI', 'key', configRows, false);
    return {
      success: res.errors.length === 0,
      action: 'saveConfig',
      operationId: operationId || null,
      saved: res.saved,
      updated: res.updated,
      errors: res.errors,
      timestamp: new Date().toISOString(),
    };
  } finally {
    lock.releaseLock();
  }
}

function isOperationAlreadyProcessed(ss, operationId) {
  if (!operationId) return false;
  var info = ensureSheetWithHeaders(ss, 'LOG_AKTIVITAS');
  var sheet = info.sheet;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  var checkRows = Math.min(lastRow - 1, 200);
  var startRow = lastRow - checkRows + 1;
  var ids = sheet.getRange(startRow, 1, checkRows, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === String(operationId).trim()) {
      return true;
    }
  }
  return false;
}

function writeActivityLog(ss, action, entityType, entityId, status, message, customLogId) {
  var info = ensureSheetWithHeaders(ss, 'LOG_AKTIVITAS');
  var sheet = info.sheet;
  var logId =
    customLogId ||
    'log-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2, 7);
  var row = [
    logId,
    action || '',
    entityType || '',
    entityId || '',
    status || 'info',
    message || '',
    new Date().toISOString(),
  ];
  sheet.appendRow(row);
  return logId;
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = String(params.action || 'ping').trim();
    var spreadsheetId = String(params.spreadsheetId || '').trim();

    if (action === 'ping') {
      var ss = getTargetSpreadsheet(spreadsheetId);
      var availableSheets = ss.getSheets().map(function (s) {
        return s.getName();
      });
      return createJsonResponse({
        success: true,
        action: 'ping',
        service: 'EXAM EDUVERSE Apps Script',
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
        availableSheets: availableSheets,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'initializeSheets') {
      return createJsonResponse(initializeSheets(spreadsheetId));
    }

    if (action === 'getQuestions') {
      return createJsonResponse(getQuestions(spreadsheetId));
    }

    if (action === 'getDistribution') {
      return createJsonResponse(getDistribution(spreadsheetId));
    }

    if (action === 'getExamResults') {
      return createJsonResponse(getExamResults(spreadsheetId));
    }

    return createJsonResponse({
      success: false,
      action: action,
      saved: 0,
      updated: 0,
      errors: ['Action GET tidak dikenal: ' + action],
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      action: 'doGet',
      saved: 0,
      updated: 0,
      errors: [err && err.message ? err.message : String(err)],
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        action: 'doPost',
        saved: 0,
        updated: 0,
        errors: ['Body request kosong.'],
      });
    }

    var body = JSON.parse(e.postData.contents);
    var action = String(body.action || '').trim();
    var spreadsheetId = String(body.spreadsheetId || '').trim();
    var operationId = body.operationId ? String(body.operationId).trim() : null;

    if (!action) {
      return createJsonResponse({
        success: false,
        action: 'doPost',
        saved: 0,
        updated: 0,
        errors: ['Parameter "action" wajib diisi.'],
      });
    }

    if (action === 'initializeSheets') {
      return createJsonResponse(initializeSheets(spreadsheetId));
    }

    if (action === 'ping') {
      var ssPing = getTargetSpreadsheet(spreadsheetId);
      return createJsonResponse({
        success: true,
        action: 'ping',
        spreadsheetName: ssPing.getName(),
        spreadsheetId: ssPing.getId(),
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'saveConfig') {
      return createJsonResponse(saveConfigRows(spreadsheetId, body.data || body.configRows, operationId));
    }

    if (action === 'saveQuestions') {
      return createJsonResponse(saveQuestions(spreadsheetId, body.data || body.questions, operationId));
    }

    if (action === 'saveDistribution') {
      return createJsonResponse(saveDistribution(spreadsheetId, body.data || body.distribution, operationId));
    }

    if (action === 'saveStudent') {
      return createJsonResponse(saveStudent(spreadsheetId, body.data || body.student, operationId));
    }

    if (action === 'saveAnswer') {
      return createJsonResponse(saveAnswer(spreadsheetId, body.data || body.answer, operationId));
    }

    if (action === 'saveExamResult') {
      return createJsonResponse(saveExamResult(spreadsheetId, body.data || body.examResult, operationId));
    }

    if (action === 'getQuestions') {
      return createJsonResponse(getQuestions(spreadsheetId));
    }

    if (action === 'getDistribution') {
      return createJsonResponse(getDistribution(spreadsheetId));
    }

    if (action === 'getExamResults') {
      return createJsonResponse(getExamResults(spreadsheetId));
    }

    if (action === 'writeActivityLog') {
      var ssLog = getTargetSpreadsheet(spreadsheetId);
      var logData = body.data || {};
      var writtenId = writeActivityLog(
        ssLog,
        logData.action || 'custom',
        logData.entityType || 'SYSTEM',
        logData.entityId || '',
        logData.status || 'info',
        logData.message || '',
        logData.logId || operationId
      );
      return createJsonResponse({
        success: true,
        action: 'writeActivityLog',
        saved: 1,
        updated: 0,
        logId: writtenId,
        errors: [],
      });
    }

    return createJsonResponse({
      success: false,
      action: action,
      saved: 0,
      updated: 0,
      errors: ['Action POST tidak dikenal: ' + action],
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      action: 'doPost',
      saved: 0,
      updated: 0,
      errors: [err && err.message ? err.message : String(err)],
    });
  }
}
