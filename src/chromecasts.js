
var find = require('array-find');
var xtend = require('xtend');

// Guesses for nice naming and data types for Cast DNS-SD TXT keys
var chromecastTXTkeys = {
  id: { name:'uuid', type:String },
  rm: { name:'rm' },
  ve: { name:'version', type:String },
  md: { name:'model', type:String },
  ic: { name:'icon', type:String },
  fn: { name:'friendly_name', type:String },
  ca: { name:'certificate_authority', type:String },
  st: { name:'state', type:String },
  bs: { name:'bs' },
  rs: { name:'playing', type:String }
};

var parseTxtRdata = function (txt) {
  /*
   * Parse individual <character-string> records from a DNS TXT record's RDATA
   *
   * From RFC 1035 § 3.3.14
   * TXT-DATA        One or more <character-string>s.
   *
   * From RFC 1035 § 3.3
   * ... <character-string> is a single
   * length octet followed by that number of characters.  <character-string>
   * is treated as binary information, and can be up to 256 characters in
   * length (including the length octet).
  **/
  var strings = [],
    i,
    len = 1;
  for (i = 0; i < txt.length; i += len) {
    len = Number(txt[i]) + 1;
    strings.push(txt.slice(i + 1, i + len));
  }
  return strings;
};

var parseDnsSdTxt = function (txt) {
  /*
   * Parse key/value pairs from a DNS-SD TXT record
   *
   * References below from RFC 6763 § 6.4, 6.5
   *
  **/
  var i,
    key,
    value,
    data = {},
    strings = parseTxtRdata(txt);
  for (i = 0; i < strings.length; i++) {
    delimiterIndex = strings[i].indexOf(new Buffer('='));
    if (delimiterIndex > 0) {
      // The key MUST be at least one character.  DNS-SD TXT record strings
      // beginning with an '=' character (i.e., the key is missing) MUST be
      // silently ignored.
      // ...
      // Case is ignored when interpreting a key, so "papersize=A4",
      // "PAPERSIZE=A4", and "Papersize=A4" are all identical.
      key = String(strings[i].slice(0, delimiterIndex)).toLowerCase();

      // If there is an '=' in a DNS-SD TXT record string, then everything
      // after the first '=' to the end of the string is the value.  The value
      // can contain any eight-bit values including '='.
      value = strings[i].slice(delimiterIndex + 1);

      data[key] = value;
    } else if (delimiterIndex === -1) {
      // ... If there is no '=' in a DNS-SD TXT record string, then it is a
      //    boolean attribute, simply identified as being present, with no value.
      key = String(strings[i]);
      data[key] = true;
    }
    // The key MUST be at least one character.  DNS-SD TXT record strings
    // beginning with an '=' character (i.e., the key is missing) MUST be
    // silently ignored.
  }
  return data;
};

var parseChromecastTXT = function (txt) {
  var rawData = parseDnsSdTxt(txt),
    data = {},
    key,
    value,
    parser;
  for (key in rawData) {
    if (rawData.hasOwnProperty(key)) {
      parser = chromecastTXTkeys[key];
      value = rawData[key];
      if (parser) {
        if (parser.name) {
          key = parser.name;
        }
        if (typeof parser.type === 'function') {
          value = parser.type(value);
        }
      }
      data[key] = value;
    }
  }
  return data;
};


module.exports = function (mdnsCache) {
  var deviceInfo = function (name) {
    var srv = mdnsCache.queryOne(name, 'SRV'),
      txt = mdnsCache.queryOne(name, 'TXT'),
      deviceData = txt ? parseChromecastTXT(txt.data) : {},
      a;
    if (srv &&
        srv.hasOwnProperty('data') &&
        srv.data.hasOwnProperty('target')) {
      a = mdnsCache.queryOne(srv.data.target, 'A') || {};
    }

    return xtend(
      deviceData,
      {
        ipv4: a ? a.data : null,
        host: (srv && srv.data) ? srv.data.target : null,
        port: (srv && srv.data) ? srv.data.port : null,
        name: name,
        txt: txt,
        srv: srv,
        a: a
      }
    );
  };

  var allDevices = function () {
    // look for chromecasts in the mDNS data gathered
    var i,
      ptrs,
      devices = [];

    ptrs = mdnsCache.queryAll('_googlecast._tcp.local', 'PTR');
    for (i = 0; ptrs && i < ptrs.length; i++) {
      devices.push(deviceInfo(ptrs[i].data));
    }
    return devices;
  };

  var reachableDevices = function () {
    return allDevices().filter(function (device) { return !!device.friendly_name && !!device.ipv4; });
  };

  return {
    all: allDevices,
    reachable: reachableDevices,
    any: function () { var devices = reachableDevices(); return devices.length > 0 ? devices[0] : null; },
    named: function (name) { return find(reachableDevices(), function (device) { return device.friendly_name.toLowerCase() === name.toLowerCase(); }); },
    match: function (re) { return find(reachableDevices(), function (device) { return device.friendly_name.match(re); }); },
    filter: function (fn) { return reachableDevices().filter(fn); }
  };
};
