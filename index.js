var mdns = require('multicast-dns');
var find = require('array-find');
var xtend = require('xtend');

var mdnsCache = require('./src/mdns-cache');
var chromecasts = require('./src/chromecasts')(mdnsCache);

var defaults = {
  ttl: 5000,
  service_name: '_googlecast._tcp.local',
  service_type: 'PTR',
  mdns: {}
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

  var timer = setTimeout(function() {
    close();
  }, opts.ttl);


  var processAnswer = function (answer) {
    //console.log('\tAnswer for ' + answer.name + ' IN ' + answer.type);
    mdnsCache.add(answer);
  };

  var returnDevices = function (devices) {
    var device, i;
    for (i = 0; devices && i < devices.length; i++) {
      device = devices[i];
      // return each valid device once only
      if (device && !returnedDevices[device.name]) {
        // NB API change – passing friendly name and full CC details here, not A record and raw Response
        cb(null, { name:device.friendly_name, data:device.ipv4 }, device);
        returnedDevices[device.name] = true;
      }
    }
  };

  // If we have enough mDNS data gathered to fulfill the caller's
  // request, respond via the callback funciton.
  var handleCallback = function () {
    if (typeof opts.filter === 'function') {
      // filter discoverd chromecasts with the provided function
      returnDevices(chromecasts.filter(opts.filter));
    } else if (opts.name) {
      // search the discovered chromecasts for specified friendly name
      returnDevices([chromecasts.named(opts.name)]);
    } else {
      // return any and all chromecasts that have IPs
      returnDevices(chromecasts.reachable());
    }

  };

  var onResponse = function(response) {
    var i;

    for (i = 0; response && response.answers && i < response.answers.length; i++) {
      processAnswer(response.answers[i]);
    }
    for (i = 0; response && response.additionals && i < response.additionals.length; i++) {
      processAnswer(response.additionals[i]);
    }

    // check to see if we have enough data to fulfill request each 
    // time we finish processing a new incoming mDNS packet
    handleCallback();
  };

  m.on('response', onResponse);

  m.query({
    questions:[{
      name: opts.service_name,
      type: opts.service_type
    }]
  });

  var close = function() {
    m.removeListener('response', onResponse);
    clearTimeout(timer);
    m.destroy();
  };

  return close;
};
