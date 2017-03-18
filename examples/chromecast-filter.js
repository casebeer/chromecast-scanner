var scanner = require('..');

var pattern = process.argv.length >= 3 ? new RegExp(process.argv[2]) : /.*/;

scanner(
  { filter: function (device) { return device.friendly_name.match(pattern); } },
  function(err, _, device) {
    if (err) return console.log(err.message);
    console.log('mDNS: Chromecast "%s" %s\trunning on %s:%s (%s)',
      device.friendly_name,
      device.playing ? 'playing "' + device.playing + '"' : '(idle)',
      device.host,
      device.port,
      device.ipv4
    );
  }
);

