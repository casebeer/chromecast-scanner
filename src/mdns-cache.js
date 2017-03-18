var mdnsDB = {};

// Add a record to the cache
var mdnsCacheAdd = function (record) {
  if (record && record.name && record.type) {
    if (!mdnsDB.hasOwnProperty(record.name)) {
      mdnsDB[record.name] = {};
    }
    if (!mdnsDB[record.name].hasOwnProperty(record.type)) {
      mdnsDB[record.name][record.type] = [];
    }
    mdnsDB[record.name][record.type].push(record);
  }
};

// Retrieve all matching records as an array
var mdnsCacheQueryAll = function (name, type) {
  if (mdnsDB.hasOwnProperty(name)) {
    if (mdnsDB[name].hasOwnProperty(type)) {
      return mdnsDB[name][type];
    }
  }
};

// Retrieve the first (if any) matching record
var mdnsCacheQueryOne = function (name, type) {
  var records = mdnsCacheQueryAll(name, type);
  if (records) {
    return records[0];
  }
};

// Debugging helpers

var mdnsCacheContents = function () {
  var records = [],
  name, type;
  for (name in mdnsDB) {
    if (mdnsDB.hasOwnProperty(name)) {
      for (type in mdnsDB[name]) {
        if (mdnsDB[name].hasOwnProperty(type)) {
          records.push([name, type]);
        }
      }
    }
  }
  return records;
};

var mdnsRecordSummary = function (name, type) {
  var record = mdnsCacheQueryAll(name, type);
  return name + ' IN ' + type + '\t' + record.length > 1 ? '(' + record.length + ')' : record[0].data;
};

var mdnsCacheSummary = function () {
  var records,
  summaries = [],
  name,
  type,
  i;
  records = mdnsCacheContents();
  for (i = 0; i < records.length; i++) {
    summaries.push(mdnsRecordSummary(records[i][0], records[i][1]));
  }
  return summaries.join('\n');
};

module.exports = {
  add: mdnsCacheAdd,
  queryOne: mdnsCacheQueryOne,
  queryAll: mdnsCacheQueryAll,
  summary: mdnsCacheSummary,
};
