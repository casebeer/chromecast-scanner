var mdns = require('multicast-dns');
var find = require('array-find');
var xtend = require('xtend');

var mdnsCache = require('./src/mdns-cache');
var chromecasts = require('./src/chromecasts')(mdnsCache);

var defaults = {
  ttl: 5000,
  service_name: '_googlecast._tcp.local',
  service_type: 'PTR',
  mdns: {},
  retry_timeout: 1000,
  search_retry_count: 3
};

module.exports = function(opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = defaults;
  } else {
    opts = xtend(defaults, opts);
  }

  var m = mdns(opts.mdns);
  var returnedDevices = {};
  var retryLock = false;
  var queryLock = false;

  var timer = setTimeout(function() {
    close();
  }, opts.ttl);

  var doQuery = function (opts) {
    // only run queries if we havnen't close()ed down yet
    if (!queryLock) {
      m.query(opts);
    }
  };


  var processAnswer = function (answer) {
    //console.log('\tAnswer for ' + answer.name + ' IN ' + answer.type);
    mdnsCache.add(answer);
  };

  var returnDevices = function (devices, response) {
    var device, i;
    for (i = 0; devices && i < devices.length; i++) {
      device = devices[i];
      // return each valid device once only
      if (device && !returnedDevices[device.name]) {
        // NB API change – passing friendly name and full CC details here, not A record and raw Response
        cb(null, xtend(device.a, { name:device.friendly_name, device:device }), response);
        returnedDevices[device.name] = true;
      }
    }
  };

  // If we have enough mDNS data gathered to fulfill the caller's
  // request, respond via the callback funciton.
  var handleCallback = function (response) {
    if (typeof opts.filter === 'function') {
      // filter discoverd chromecasts with the provided function
      returnDevices(chromecasts.filter(opts.filter), response);
    } else if (opts.name) {
      // search the discovered chromecasts for specified friendly name
      returnDevices([chromecasts.named(opts.name)], response);
    } else {
      // return any and all chromecasts that have IPs
      returnDevices(chromecasts.reachable(), response);
    }
  };

  var requestAdditional = function () {
    // Ensure we have SRV, TXT, and A records for all discovered Chromecasts
    // Request the data in case it wasn't in the ADDITIONAL section of the initial response
    var i,
      device,
      questions = [],
      devices;
    // don't bother checking if we're not allowed to send queries
    if (!retryLock && !queryLock) {
      //console.log('Checking for data completeness...');
      devices = chromecasts.all();
      for (i = 0; i < devices.length; i++) {
        device = devices[i];
        //console.log("Device is %s", device.name);
        if (device) {
          if (!device.uuid) {
            // missing UUID means we didn't get the TXT record
            questions.push({
              name: device.name,
              type: 'TXT'
            });
          }
          if (!device.ipv4) {
            // missing A record
            if (!device.host) {
              // missing SRV record
              questions.push({
                name: device.name,
                type: 'SRV'
              });
            } else {
              // we have a have hostname from the SRV record, just need the A
              questions.push({
                name: device.host,
                type: 'A'
              });
            }
          }
        }
      }
      if (questions.length > 0) {
        //console.log('Extra questions: %s', questions.map(function (q) { return q.name + ' IN ' + q.type; }));
        doQuery({ questions: questions });

        // set lock to prevent another re-query for opts.retry_timeout milliseconds (default 1000 ms)
        retryLock = true;
        setTimeout(function () {
          retryLock = false;
          requestAdditional();
        }, opts.retry_timeout);
      }
    }
  }

  var onResponse = function(response) {
    var i;

    for (i = 0; response && response.answers && i < response.answers.length; i++) {
      processAnswer(response.answers[i]);
    }
    for (i = 0; response && response.additionals && i < response.additionals.length; i++) {
      processAnswer(response.additionals[i]);
    }

    requestAdditional();

    // check to see if we have enough data to fulfill request each 
    // time we finish processing a new incoming mDNS packet
    handleCallback(response);
  };

  m.on('response', onResponse);

  var doPTRSearch = function (queries_remaining) {
    // Run opts.search_retry_count queries (default 3 queries) for chromecasts
    // at retry_timeout millisecond (default 1000 ms) intervals
    // Raises chances of quickly seeing Cast devices if the first query was missed.
    doQuery({
      questions:[{
        name: opts.service_name,
        type: opts.service_type
      }]
    });
    if (queries_remaining > 1) {
      setTimeout(function () { doPTRSearch(queries_remaining - 1); }, opts.retry_timeout);
    }
  };
  doPTRSearch(opts.search_retry_count);

  var close = function() {
    queryLock = true;
    m.removeListener('response', onResponse);
    clearTimeout(timer);
    m.destroy();
  };

  return close;
};
