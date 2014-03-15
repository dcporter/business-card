// --------------------------------
// JavaScript Utilities
//

// JavaScript augmenting. Code improved from (and committed back to) SproutCore .fmt method.
String.prototype.fmt = function() {
  var args = arguments,
      data,
      string = this.toString();

  if (args.length === 1 && typeof args[0] === 'object') {
    data = args[0];
    return string.replace(/%\{(.*?)\}/g, function(match, propertyPath) {
      var ret = (function(key, data, /* for debugging purposes: */ string) {
        var arg, value, formatter, argsplit = key.indexOf(':');
        if (argsplit > -1) {
          arg = key.substr(argsplit + 1);
          key = key.substr(0, argsplit);
        }
        
        value = data[key];
        formatter = data[key + 'Formatter'];
        
        // formatters are optional
        if (formatter) value = formatter(value, arg);
        else if (arg) {
          throw "String.fmt was given a formatting string, but key `" + key + "` has no formatter! String: " + string;
        }
        
        return value;
      })(propertyPath, data, string);
      // If ret returns nothing, just spit the match back out.
      if (ret === null || ret === undefined) return match;
      else return ret;
    })
  }

  else {
    i = 0;
    return string.replace(/%@([0-9]+)?/g, function(match, index) {
      index = index ? parseInt(index, 10) - 1 : i++;
      if(args[index]!==undefined) return args[index];
      else return "";
    });
  }
}
