var assert = require('assert');
var path = require('path');
var proxyquire = require('proxyquire');

describe('config manager', function () {

  describe('single configuration file', function () {
    var configManager = proxyquire('../lib/config-manager', {
      'path': {
        join: function () {
          if (arguments[0] === process.cwd()) {
            arguments[0] = path.join(process.cwd(), 'test', 'fixtures');
            return path.join.apply(this, arguments);
          }
          return path.join.apply(null, arguments);
        }
      }
    });

    it('should handle non existent files', function () {
      assert.deepEqual(configManager('non_existent_config'), {});
    });

    it('should throw if the configuration file is invalid', function () {
      assert.throws(function () {
        configManager('invalid-config');
      });
    });

    it('should read values from the configuration file', function () {
      var config = configManager('valid-config');
      assert.equal(config.key1, 'val1');
    });
  });

  describe('multiple config files', function () {
    var configManager;

    beforeEach(function () {
      configManager = proxyquire('../lib/config-manager', {
        'path': {
          join: function () {
            if (arguments[0] === process.cwd()) {
              return path.join(path.join(process.cwd(), 'test', 'fixtures', 'config', 'local'), arguments[2]);
            } else {
              return path.join(path.join(process.cwd(), 'test', 'fixtures', 'config', 'atlasboard'), arguments[2]);
            }
          }
        }
      });
    });

    it('should extend atlasboard config', function () {
      var config = configManager('test');
      assert.equal(config.key1, 'key 1 - localvalue');
      assert.equal(config.key2, 'key 2 - atlasboard value');
      assert.equal(config.key3, 'key 3 - localvalue');
    });

  });

  describe('reads env input', function () {
    var configManager;

    beforeEach(function () {
      configManager = proxyquire('../lib/config-manager', {
        'path': {
          join: function () {
            if (arguments[0] === process.cwd()) {
              return path.join(path.join(process.cwd(), 'test', 'fixtures', 'config', 'local'), arguments[2]);
            } else {
              return path.join(path.join(process.cwd(), 'test', 'fixtures', 'config', 'atlasboard'), arguments[2]);
            }
          }
        }
      });
    });

    it('should be extended by ENV variables', function () {
      process.env['ATLASBOARD_CONFIG_test'] = JSON.stringify({key1: 'key from env'});
      var config = configManager('test');
      assert.equal(config.key1, 'key from env');
      assert.equal(config.key2, 'key 2 - atlasboard value');
    });

    it('should throw if invalid JSON', function () {
      process.env['ATLASBOARD_CONFIG_test'] = '{key1: INVALID JSON';
      assert.throws(function(){
        configManager('test');
      });
    });

    it('should throw if ENV key can not be serialized to an object', function () {
      process.env['ATLASBOARD_CONFIG_test'] = '"VALID JSON, but not an object"';
      assert.throws(function(){
        configManager('test');
      });
    });
  });
});