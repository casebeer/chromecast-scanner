#!/usr/bin/env node

var scanner = require('..');

var pattern = process.argv.length >= 3 ? new RegExp(process.argv[2]) : /.*/;

scanner(
  { filter: function (device) { return device.friendly_name.match(pattern); } },
  function(err, device) {
    if (err) return console.log(err.message);
    //console.log(device);
    console.log('mDNS: %s "%s" %s\n\trunning on %s:%s (%s)',
      device.model,
      device.friendly_name,
      device.playing ? 'playing "' + device.playing + '"' : '(idle)',
      device.host,
      device.port,
      device.ipv4
    );
  }
);

