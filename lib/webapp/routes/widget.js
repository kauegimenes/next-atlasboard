var fs = require('fs');
var path = require('path');
var stylus = require('../../stylus');
var cssModule = require('css');
var itemManager = require('../../item-manager');
var logger = require('../../logger')();

function getSafeItemName (itemName){
  return path.basename(itemName).split('.')[0];
}

// TODO: move namespacing processing to a separate module
function addNamespacesCSSToResponse(css, namespace, res) {
  res.write("<style>");
  addNamespace(css, res, namespace);
  res.write("</style>");
}

function addNamespace (css, res, widgetNamespace){
  function namespaceRulesAST (rules) {
    rules.forEach(function (rule) {
      if (rule.selectors) {
        rule.selectors = rule.selectors.map(function (selector) {
          if (selector === '@font-face') {
            return selector;
          }
          // it is important to set the right specificity to widget rules can precede the default ones
          return '#widgets-container > ul > li[data-widget-id="' + widgetNamespace + '"] ' + selector;
        });
      }
      // Handle rules within media queries
      if (rule.rules) {
        namespaceRulesAST(rule.rules);
      }
    });
  }

  if (css) {
    try {
      var cssAST = cssModule.parse(css.toString());
      namespaceRulesAST(cssAST.stylesheet.rules);
      res.write(cssModule.stringify(cssAST));
    } catch (e) {
      logger.error(e);
    }
  }
}

module.exports = {

    // ---------------------------------------------------------------
    // Render specific resource for a widget
    // - resource format: <package>/<widget>/<resource>
    //   ex: atlassian/blockers/icon.png
    // ---------------------------------------------------------------
    renderWidgetResource: function (localPackagesPath, resource, req, res){
      if (!resource){
        return res.status(400).send('resource id not specified');
      }
      //sanitization
      var input = resource.split('/');
      if (input.length !== 3) {
        return res.status(400).send('bad input');
      }
      var packageName = input[0];
      var widgetName = input[1];
      var resourceName = input[2];

      //TODO: add extra sanitization
      var resourcePath = path.join(localPackagesPath, packageName, 'widgets', widgetName, resourceName);
      if (fs.existsSync(resourcePath)){
        res.sendFile(resourcePath);
      }
      else {
        return res.status(404).send('resource not found');
      }
    },

    // ---------------------------------------------------------------
    // Render JS for a specific widget
    // ---------------------------------------------------------------
    renderJsWidget: function (packagesPath, widgetName, req, res){
      res.type("application/javascript");
      widgetName = getSafeItemName(widgetName);
      itemManager.getFirst(packagesPath, widgetName, "widgets", ".js", function(err, jsFile){
        if (err || !jsFile){
          var msg = err ? err : 'JS file not found for widget ' + widgetName;
          logger.error(msg)
          res.status(400).send("Error rendering widget: " + msg);
        } else {
          res.sendFile(jsFile);
        }
      });
    },

    // ---------------------------------------------------------------
    // Render HTML and styles (CSS/Stylus)
    // ---------------------------------------------------------------
    renderHtmlWidget : function (packagesPath, widgetName, req, res){

      widgetName = getSafeItemName(widgetName);

      function getFileContents (extension, cb){
        itemManager.getFirst(packagesPath, widgetName, "widgets", extension, function (err, path) {
          if (err || !path) {
            return cb(err ? err : 'File does not exist');
          }
          fs.readFile(path, 'utf-8', cb);
        });
      }

      function loadHTML (res, cb) {
        getFileContents(".html", function (err, html) {
          if (!err && html) {
            res.write(html);
          }
          cb(err);
        });
      }

      function loadCSSIfPresent (res, cb){
        getFileContents(".css", function(err, css){
          if (!err && css) {
            addNamespacesCSSToResponse(css, widgetName, res);
          }
          cb(err);
        });
      }

      function loadStylusIfPresent(res, cb) {
        getFileContents(".styl", function(err, stylusContent){
          if (!err && stylusContent) {
            stylus.getWidgetCSS(stylusContent, function(err, css){
              if (!err) {
                addNamespacesCSSToResponse(css, widgetName, res);
              } else {
                logger.error(err);
              }
              cb(err);
            });
          } else {
            cb(err);
          }
        });
      }

      res.type("text/html");

      loadStylusIfPresent(res, function(){
        loadCSSIfPresent(res, function(){
          loadHTML(res, function(err){
            if (err) {
              res.status(500).send("Error rendering widget: " + err);
            } else {
              res.end();
            }
          });
        });
      });
    },

    log : function (req, res){
      res.render(path.join(__dirname, "../..", "templates", "dashboard-log.ejs"));
    },

    // For testing only
    _addNamespace: addNamespace
};
