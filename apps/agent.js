{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/components/sealed-html-preview/styles.module.css */\n.frame_vzhnqg {\n  display: block;\n  border: 2px solid var(--stage-line);\n  background: var(--stage-panel);\n  box-sizing: border-box;\n  width: 100%;\n  min-height: 12rem;\n  max-height: 28rem;\n}\n\n.fill_vzhnqg {\n  height: 100%;\n  min-height: 0;\n  max-height: none;\n}\n";document.head.append(s);}
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// node_modules/dompurify/dist/purify.es.mjs
function _arrayLikeToArray(r, a) {
  (a == null || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a);e < a; e++)
    n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r))
    return r;
}
function _iterableToArrayLimit(r, l) {
  var t = r == null ? null : typeof Symbol != "undefined" && r[Symbol.iterator] || r["@@iterator"];
  if (t != null) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, l === 0)
        ;
      else
        for (;!(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true)
          ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && t.return != null && (u = t.return(), Object(u) !== u))
          return;
      } finally {
        if (o)
          throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if (typeof r == "string")
      return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return t === "Object" && r.constructor && (t = r.constructor.name), t === "Map" || t === "Set" ? Array.from(r) : t === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : undefined;
  }
}
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) {
      thisArg.lastIndex = 0;
    }
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1;_key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0;_key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) {
    setPrototypeOf(set, null);
  }
  if (!arrayIsArray(array)) {
    return set;
  }
  let l = array.length;
  while (l--) {
    let element = array[l];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) {
          array[l] = lcElement;
        }
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0;index < array.length; index++) {
    const isPropertyExist = objectHasOwnProperty(array, index);
    if (!isPropertyExist) {
      array[index] = null;
    }
  }
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const _ref2 of entries(object)) {
    var _ref3 = _slicedToArray(_ref2, 2);
    const property = _ref3[0];
    const value = _ref3[1];
    const isPropertyExist = objectHasOwnProperty(object, property);
    if (isPropertyExist) {
      if (arrayIsArray(value)) {
        newObject[property] = cleanArray(value);
      } else if (value && typeof value === "object" && value.constructor === Object) {
        newObject[property] = clone(value);
      } else {
        newObject[property] = value;
      }
    }
  }
  return newObject;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "string": {
      return value;
    }
    case "number": {
      return numberToString(value);
    }
    case "boolean": {
      return booleanToString(value);
    }
    case "bigint": {
      return bigintToString ? bigintToString(value) : "0";
    }
    case "symbol": {
      return symbolToString ? symbolToString(value) : "Symbol()";
    }
    case "undefined": {
      return objectToString(value);
    }
    case "function":
    case "object": {
      if (value === null) {
        return objectToString(value);
      }
      const valueAsRecord = value;
      const valueToString = lookupGetter(valueAsRecord, "toString");
      if (typeof valueToString === "function") {
        const stringified = valueToString(valueAsRecord);
        return typeof stringified === "string" ? stringified : objectToString(stringified);
      }
      return objectToString(value);
    }
    default: {
      return objectToString(value);
    }
  }
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) {
        return unapply(desc.get);
      }
      if (typeof desc.value === "function") {
        return unapply(desc.value);
      }
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
function isRegex(value) {
  try {
    regExpTest(value, "");
    return true;
  } catch (_unused) {
    return false;
  }
}
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.4.11";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let document2 = window2.document;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  window2.DocumentFragment;
  const { HTMLTemplateElement, Node, Element, NodeFilter, NamedNodeMap: _window$NamedNodeMap } = window2;
  _window$NamedNodeMap === undefined && (window2.NamedNodeMap || window2.MozNamedAttrMap);
  window2.HTMLFormElement;
  const { DOMParser, trustedTypes } = window2;
  const ElementPrototype = Element.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
  const getAttributes = lookupGetter(ElementPrototype, "attributes");
  const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
  const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) {
      document2 = template.content.ownerDocument;
    }
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  let defaultTrustedTypesPolicy;
  let defaultTrustedTypesPolicyResolved = false;
  let IN_TRUSTED_TYPES_POLICY = 0;
  const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy() {
    if (IN_TRUSTED_TYPES_POLICY > 0) {
      throw typeErrorCreate("A configured TRUSTED_TYPES_POLICY callback (createHTML or " + "createScriptURL) must not call DOMPurify.sanitize, as that causes " + "infinite recursion. Do not pass a policy whose callbacks wrap " + 'DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted ' + 'Types" section of the README.');
    }
  };
  const _createTrustedHTML = function _createTrustedHTML(html2) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createHTML(html2);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _createTrustedScriptURL = function _createTrustedScriptURL(scriptUrl) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createScriptURL(scriptUrl);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy() {
    if (!defaultTrustedTypesPolicyResolved) {
      defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      defaultTrustedTypesPolicyResolved = true;
    }
    return defaultTrustedTypesPolicy;
  };
  const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  const importNode = originalDocument.importNode;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== undefined;
  const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
  let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
  let ALLOWED_TAGS = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text2]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let SET_CONFIG_ALLOWED_TAGS = null;
  let SET_CONFIG_ALLOWED_ATTR = null;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, [
    "annotation-xml",
    "audio",
    "colgroup",
    "desc",
    "foreignobject",
    "head",
    "iframe",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    "selectedcontent",
    "style",
    "svg",
    "template",
    "thead",
    "title",
    "video",
    "xmp"
  ]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
  const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze(["mi", "mo", "mn", "ms", "mtext"]);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
  const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig() {
    let cfg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) {
      return;
    }
    if (!cfg || typeof cfg !== "object") {
      cfg = {};
    }
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, {
      transform: transformCaseFunc
    });
    ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, {
      transform: transformCaseFunc
    });
    ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, {
      transform: stringToString
    });
    URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
      transform: transformCaseFunc,
      base: DEFAULT_URI_SAFE_ATTRIBUTES
    });
    DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
      transform: transformCaseFunc,
      base: DEFAULT_DATA_URI_TAGS
    });
    FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, {
      transform: transformCaseFunc
    });
    FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), {
      transform: transformCaseFunc
    });
    FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), {
      transform: transformCaseFunc
    });
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
    NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "MATHML_TEXT_INTEGRATION_POINTS") && cfg.MATHML_TEXT_INTEGRATION_POINTS && typeof cfg.MATHML_TEXT_INTEGRATION_POINTS === "object" ? clone(cfg.MATHML_TEXT_INTEGRATION_POINTS) : addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
    HTML_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "HTML_INTEGRATION_POINTS") && cfg.HTML_INTEGRATION_POINTS && typeof cfg.HTML_INTEGRATION_POINTS === "object" ? clone(cfg.HTML_INTEGRATION_POINTS) : addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
    const customElementHandling = objectHasOwnProperty(cfg, "CUSTOM_ELEMENT_HANDLING") && cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING === "object" ? clone(cfg.CUSTOM_ELEMENT_HANDLING) : create(null);
    CUSTOM_ELEMENT_HANDLING = create(null);
    if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
      CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
    }
    seal(CUSTOM_ELEMENT_HANDLING);
    if (SAFE_FOR_TEMPLATES) {
      ALLOW_DATA_ATTR = false;
    }
    if (RETURN_DOM_FRAGMENT) {
      RETURN_DOM = true;
    }
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, text2);
      ALLOWED_ATTR = create(null);
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg$1);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    EXTRA_ELEMENT_HANDLING.tagCheck = null;
    EXTRA_ELEMENT_HANDLING.attributeCheck = null;
    if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
      if (typeof cfg.ADD_TAGS === "function") {
        EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      } else if (arrayIsArray(cfg.ADD_TAGS)) {
        if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
          ALLOWED_TAGS = clone(ALLOWED_TAGS);
        }
        addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
      if (typeof cfg.ADD_ATTR === "function") {
        EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      } else if (arrayIsArray(cfg.ADD_ATTR)) {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
          ALLOWED_ATTR = clone(ALLOWED_ATTR);
        }
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR)) {
      addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
    }
    if (objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
    }
    if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) {
      ALLOWED_TAGS["#text"] = true;
    }
    if (WHOLE_DOCUMENT) {
      addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
    }
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      }
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      }
      const previousTrustedTypesPolicy = trustedTypesPolicy;
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      try {
        emptyHTML = _createTrustedHTML("");
      } catch (error) {
        trustedTypesPolicy = previousTrustedTypesPolicy;
        throw error;
      }
    } else if (cfg.TRUSTED_TYPES_POLICY === null) {
      trustedTypesPolicy = undefined;
      emptyHTML = "";
    } else {
      if (trustedTypesPolicy === undefined) {
        trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
      }
      if (trustedTypesPolicy && typeof emptyHTML === "string") {
        emptyHTML = _createTrustedHTML("");
      }
    }
    if (freeze) {
      freeze(cfg);
    }
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkSvgNamespace = function _checkSvgNamespace(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "svg";
    }
    if (parent.namespaceURI === MATHML_NAMESPACE) {
      return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
    }
    return Boolean(ALL_SVG_TAGS[tagName]);
  };
  const _checkMathMlNamespace = function _checkMathMlNamespace(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "math";
    }
    if (parent.namespaceURI === SVG_NAMESPACE) {
      return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
    }
    return Boolean(ALL_MATHML_TAGS[tagName]);
  };
  const _checkHtmlNamespace = function _checkHtmlNamespace(tagName, parent, parentTagName) {
    if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
  };
  const _checkValidNamespace = function _checkValidNamespace(element) {
    let parent = getParentNode(element);
    if (!parent || !parent.tagName) {
      parent = {
        namespaceURI: NAMESPACE,
        tagName: "template"
      };
    }
    const tagName = stringToLowerCase(element.tagName);
    const parentTagName = stringToLowerCase(parent.tagName);
    if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
      return false;
    }
    if (element.namespaceURI === SVG_NAMESPACE) {
      return _checkSvgNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === MATHML_NAMESPACE) {
      return _checkMathMlNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === HTML_NAMESPACE) {
      return _checkHtmlNamespace(tagName, parent, parentTagName);
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
      return true;
    }
    return false;
  };
  const _forceRemove = function _forceRemove(node) {
    arrayPush(DOMPurify.removed, {
      element: node
    });
    try {
      getParentNode(node).removeChild(node);
    } catch (_) {
      remove(node);
      if (!getParentNode(node)) {
        throw typeErrorCreate("a node selected for removal could not be detached from its tree " + "and cannot be safely returned; refusing to sanitize in place");
      }
    }
  };
  const _neutralizeRoot = function _neutralizeRoot(root) {
    const childNodes = getChildNodes(root);
    if (childNodes) {
      const snapshot = [];
      arrayForEach(childNodes, (child) => {
        arrayPush(snapshot, child);
      });
      arrayForEach(snapshot, (child) => {
        try {
          remove(child);
        } catch (_) {}
      });
    }
    const attributes = getAttributes(root);
    if (attributes) {
      for (let i = attributes.length - 1;i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name === "string") {
          try {
            root.removeAttribute(name);
          } catch (_) {}
        }
      }
    }
  };
  const _removeAttribute = function _removeAttribute(name, element) {
    try {
      arrayPush(DOMPurify.removed, {
        attribute: element.getAttributeNode(name),
        from: element
      });
    } catch (_) {
      arrayPush(DOMPurify.removed, {
        attribute: null,
        from: element
      });
    }
    element.removeAttribute(name);
    if (name === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
        try {
          _forceRemove(element);
        } catch (_) {}
      } else {
        try {
          element.setAttribute(name, "");
        } catch (_) {}
      }
    }
  };
  const _stripDisallowedAttributes = function _stripDisallowedAttributes(element) {
    const attributes = getAttributes(element);
    if (!attributes) {
      return;
    }
    for (let i = attributes.length - 1;i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) {
        continue;
      }
      try {
        element.removeAttribute(name);
      } catch (_) {}
    }
  };
  const _neutralizeSubtree = function _neutralizeSubtree(root) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
      if (nodeType === NODE_TYPE.element) {
        _stripDisallowedAttributes(node);
      }
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1;i >= 0; --i) {
          stack.push(childNodes[i]);
        }
      }
    }
  };
  const _initDocument = function _initDocument(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) {
      dirty = "<remove></remove>" + dirty;
    } else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
      dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    }
    const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) {
      try {
        doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
      } catch (_) {}
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_) {}
    }
    const body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) {
      body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    }
    if (NAMESPACE === HTML_NAMESPACE) {
      return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    }
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  const _createNodeIterator = function _createNodeIterator(root) {
    return createNodeIterator.call(root.ownerDocument || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
  };
  const _stripTemplateExpressions = function _stripTemplateExpressions(value) {
    value = stringReplace(value, MUSTACHE_EXPR$1, " ");
    value = stringReplace(value, ERB_EXPR$1, " ");
    value = stringReplace(value, TMPLIT_EXPR$1, " ");
    return value;
  };
  const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
    var _node$querySelectorAl;
    node.normalize();
    const walker = createNodeIterator.call(node.ownerDocument || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
    let currentNode = walker.nextNode();
    while (currentNode) {
      currentNode.data = _stripTemplateExpressions(currentNode.data);
      currentNode = walker.nextNode();
    }
    const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === undefined ? undefined : _node$querySelectorAl.call(node, "template");
    if (templates) {
      arrayForEach(templates, (tmpl) => {
        if (_isDocumentFragment(tmpl.content)) {
          _scrubTemplateExpressions2(tmpl.content);
        }
      });
    }
  };
  const _isClobbered = function _isClobbered(element) {
    const realTagName = getNodeName ? getNodeName(element) : null;
    if (typeof realTagName !== "string") {
      return false;
    }
    if (transformCaseFunc(realTagName) !== "form") {
      return false;
    }
    return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
  };
  const _isDocumentFragment = function _isDocumentFragment(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return getNodeType(value) === NODE_TYPE.documentFragment;
    } catch (_) {
      return false;
    }
  };
  const _isNode = function _isNode(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return typeof getNodeType(value) === "number";
    } catch (_) {
      return false;
    }
  };
  function _executeHooks(hooks2, currentNode, data) {
    if (hooks2.length === 0) {
      return;
    }
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _isUnsafeNode = function _isUnsafeNode(currentNode, tagName) {
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && tagName === "style" && _isNode(currentNode.firstElementChild)) {
      return true;
    }
    if (currentNode.nodeType === NODE_TYPE.processingInstruction) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) {
      return true;
    }
    return false;
  };
  const _sanitizeDisallowedNode = function _sanitizeDisallowedNode(currentNode, tagName) {
    if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
      if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
        return false;
      }
      if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
        return false;
      }
    }
    if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
      const parentNode = getParentNode(currentNode);
      const childNodes = getChildNodes(currentNode);
      if (childNodes && parentNode) {
        const childCount = childNodes.length;
        for (let i = childCount - 1;i >= 0; --i) {
          const hoisted = IN_PLACE ? childNodes[i] : cloneNode(childNodes[i], true);
          parentNode.insertBefore(hoisted, getNextSibling(currentNode));
        }
      }
    }
    _forceRemove(currentNode);
    return true;
  };
  const _sanitizeElements = function _sanitizeElements(currentNode) {
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(getNodeName ? getNodeName(currentNode) : currentNode.nodeName);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (_isUnsafeNode(currentNode, tagName)) {
      _forceRemove(currentNode);
      return true;
    }
    if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
      return _sanitizeDisallowedNode(currentNode, tagName);
    }
    const nt = getNodeType ? getNodeType(currentNode) : currentNode.nodeType;
    if (nt === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      const content = _stripTemplateExpressions(currentNode.textContent);
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, {
          element: currentNode.cloneNode()
        });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return false;
  };
  const _isValidAttribute = function _isValidAttribute(lcTag, lcName, value) {
    if (FORBID_ATTR[lcName]) {
      return false;
    }
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && ((value in document2) || (value in formElement))) {
      return false;
    }
    const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
    if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName))
      ;
    else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName))
      ;
    else if (!nameIsPermitted) {
      if (_isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value)))
        ;
      else {
        return false;
      }
    } else if (URI_SAFE_ATTRIBUTES[lcName])
      ;
    else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, "")))
      ;
    else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag])
      ;
    else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, "")))
      ;
    else if (value) {
      return false;
    } else
      ;
    return true;
  };
  const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
  const _isBasicCustomElement = function _isBasicCustomElement(tagName) {
    return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
  };
  const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value) {
    if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) {
      switch (trustedTypes.getAttributeType(lcTag, lcName)) {
        case "TrustedHTML": {
          return _createTrustedHTML(value);
        }
        case "TrustedScriptURL": {
          return _createTrustedScriptURL(value);
        }
      }
    }
    return value;
  };
  const _setAttributeValue = function _setAttributeValue(currentNode, name, namespaceURI, value) {
    try {
      if (namespaceURI) {
        currentNode.setAttributeNS(namespaceURI, name, value);
      } else {
        currentNode.setAttribute(name, value);
      }
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
      } else {
        arrayPop(DOMPurify.removed);
      }
    } catch (_) {
      _removeAttribute(name, currentNode);
    }
  };
  const _sanitizeAttributes = function _sanitizeAttributes(currentNode) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    const attributes = currentNode.attributes;
    if (!attributes || _isClobbered(currentNode)) {
      return;
    }
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: undefined
    };
    let l = attributes.length;
    const lcTag = transformCaseFunc(currentNode.nodeName);
    while (l--) {
      const attr = attributes[l];
      const { name, namespaceURI, value: attrValue } = attr;
      const lcName = transformCaseFunc(name);
      const initValue = attrValue;
      let value = name === "value" ? initValue : stringTrim(initValue);
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = undefined;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
        _removeAttribute(name, currentNode);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
      }
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (lcName === "attributename" && stringMatch(value, "href")) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (hookEvent.forceKeepAttr) {
        continue;
      }
      if (!hookEvent.keepAttr) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) {
        value = _stripTemplateExpressions(value);
      }
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
      if (value !== initValue) {
        _setAttributeValue(currentNode, name, namespaceURI, value);
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
  };
  const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode);
      _sanitizeAttributes(shadowNode);
      if (_isDocumentFragment(shadowNode.content)) {
        _sanitizeShadowDOM2(shadowNode.content);
      }
      const shadowNodeType = getNodeType ? getNodeType(shadowNode) : shadowNode.nodeType;
      if (shadowNodeType === NODE_TYPE.element) {
        const innerSr = getShadowRoot(shadowNode);
        if (_isDocumentFragment(innerSr)) {
          _sanitizeAttachedShadowRoots(innerSr);
          _sanitizeShadowDOM2(innerSr);
        }
      }
    }
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots(root) {
    const stack = [{
      node: root,
      shadow: null
    }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.shadow) {
        _sanitizeShadowDOM2(item.shadow);
        continue;
      }
      const node = item.node;
      const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
      const isElement = nodeType === NODE_TYPE.element;
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1;i >= 0; --i) {
          stack.push({
            node: childNodes[i],
            shadow: null
          });
        }
      }
      if (isElement) {
        const rootName = getNodeName ? getNodeName(node) : null;
        if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
          const content = node.content;
          if (_isDocumentFragment(content)) {
            stack.push({
              node: content,
              shadow: null
            });
          }
        }
      }
      if (isElement) {
        const sr = getShadowRoot(node);
        if (_isDocumentFragment(sr)) {
          stack.push({
            node: null,
            shadow: sr
          }, {
            node: sr,
            shadow: null
          });
        }
      }
    }
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    let body = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) {
      dirty = "<!-->";
    }
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      dirty = stringifyValue(dirty);
      if (typeof dirty !== "string") {
        throw typeErrorCreate("dirty is not a string, aborting");
      }
    }
    if (!DOMPurify.isSupported) {
      return dirty;
    }
    if (SET_CONFIG) {
      ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
      ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
    } else {
      _parseConfig(cfg);
    }
    if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_TAGS = clone(ALLOWED_TAGS);
    }
    if (hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_ATTR = clone(ALLOWED_ATTR);
    }
    DOMPurify.removed = [];
    const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
    if (inPlace) {
      const nn = getNodeName ? getNodeName(dirty) : dirty.nodeName;
      if (typeof nn === "string") {
        const tagName = transformCaseFunc(nn);
        if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
      if (_isClobbered(dirty)) {
        throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
      }
      try {
        _sanitizeAttachedShadowRoots(dirty);
      } catch (error) {
        _neutralizeRoot(dirty);
        throw error;
      }
    } else if (_isNode(dirty)) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
        body = importedNode;
      } else if (importedNode.nodeName === "HTML") {
        body = importedNode;
      } else {
        body.appendChild(importedNode);
      }
      _sanitizeAttachedShadowRoots(importedNode);
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) {
        return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
      }
      body = _initDocument(dirty);
      if (!body) {
        return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
      }
    }
    if (body && FORCE_BODY) {
      _forceRemove(body.firstChild);
    }
    const nodeIterator = _createNodeIterator(inPlace ? dirty : body);
    try {
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode);
        _sanitizeAttributes(currentNode);
        if (_isDocumentFragment(currentNode.content)) {
          _sanitizeShadowDOM2(currentNode.content);
        }
      }
    } catch (error) {
      if (inPlace) {
        _neutralizeRoot(dirty);
      }
      throw error;
    }
    if (inPlace) {
      arrayForEach(DOMPurify.removed, (entry) => {
        if (entry.element) {
          _neutralizeSubtree(entry.element);
        }
      });
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(dirty);
      }
      return dirty;
    }
    if (RETURN_DOM) {
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(body);
      }
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) {
          returnNode.appendChild(body.firstChild);
        }
      } else {
        returnNode = body;
      }
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
        returnNode = importNode.call(originalDocument, returnNode, true);
      }
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
      serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + `>
` + serializedHTML;
    }
    if (SAFE_FOR_TEMPLATES) {
      serializedHTML = _stripTemplateExpressions(serializedHTML);
    }
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
    SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
    SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
    SET_CONFIG_ALLOWED_TAGS = null;
    SET_CONFIG_ALLOWED_ATTR = null;
    trustedTypesPolicy = defaultTrustedTypesPolicy;
    emptyHTML = "";
  };
  DOMPurify.isValidAttribute = function(tag, attr, value) {
    if (!CONFIG) {
      _parseConfig({});
    }
    const lcTag = transformCaseFunc(tag);
    const lcName = transformCaseFunc(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") {
      return;
    }
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    if (hookFunction !== undefined) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? undefined : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var entries, setPrototypeOf, isFrozen, getPrototypeOf, getOwnPropertyDescriptor, freeze, seal, create, _ref, apply, construct, arrayForEach, arrayLastIndexOf, arrayPop, arrayPush, arraySplice, arrayIsArray, stringToLowerCase, stringToString, stringMatch, stringReplace, stringIndexOf, stringTrim, numberToString, booleanToString, bigintToString, symbolToString, objectHasOwnProperty, objectToString, regExpTest, typeErrorCreate, html$1, svg$1, svgFilters, svgDisallowed, mathMl$1, mathMlDisallowed, text2, html, svg, mathMl, xml, MUSTACHE_EXPR, ERB_EXPR, TMPLIT_EXPR, DATA_ATTR, ARIA_ATTR, IS_ALLOWED_URI, IS_SCRIPT_OR_DATA, ATTR_WHITESPACE, DOCTYPE_NAME, CUSTOM_ELEMENT, ELEMENT_MARKUP_PROBE, COMMENT_MARKUP_PROBE, FALLBACK_TAG_CLOSE, SELF_CLOSING_TAG, NODE_TYPE, getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
}, _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
    return null;
  }
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
    suffix = purifyHostElement.getAttribute(ATTR_NAME);
  }
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html2) {
        return html2;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
}, _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
}, _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options) {
  return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
}, purify;
var init_purify_es = __esm(() => {
  /*! @license DOMPurify 3.4.11 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.11/LICENSE */
  entries = Object.entries;
  setPrototypeOf = Object.setPrototypeOf;
  isFrozen = Object.isFrozen;
  getPrototypeOf = Object.getPrototypeOf;
  getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  freeze = Object.freeze;
  seal = Object.seal;
  create = Object.create;
  _ref = typeof Reflect !== "undefined" && Reflect;
  apply = _ref.apply;
  construct = _ref.construct;
  if (!freeze) {
    freeze = function freeze(x) {
      return x;
    };
  }
  if (!seal) {
    seal = function seal(x) {
      return x;
    };
  }
  if (!apply) {
    apply = function apply(func, thisArg) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2;_key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }
      return func.apply(thisArg, args);
    };
  }
  if (!construct) {
    construct = function construct(Func) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1;_key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      return new Func(...args);
    };
  }
  arrayForEach = unapply(Array.prototype.forEach);
  arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
  arrayPop = unapply(Array.prototype.pop);
  arrayPush = unapply(Array.prototype.push);
  arraySplice = unapply(Array.prototype.splice);
  arrayIsArray = Array.isArray;
  stringToLowerCase = unapply(String.prototype.toLowerCase);
  stringToString = unapply(String.prototype.toString);
  stringMatch = unapply(String.prototype.match);
  stringReplace = unapply(String.prototype.replace);
  stringIndexOf = unapply(String.prototype.indexOf);
  stringTrim = unapply(String.prototype.trim);
  numberToString = unapply(Number.prototype.toString);
  booleanToString = unapply(Boolean.prototype.toString);
  bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
  symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
  objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
  objectToString = unapply(Object.prototype.toString);
  regExpTest = unapply(RegExp.prototype.test);
  typeErrorCreate = unconstruct(TypeError);
  html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
  svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
  svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
  svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
  mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
  mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
  text2 = freeze(["#text"]);
  html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
  svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
  mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
  xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
  MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
  ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
  TMPLIT_EXPR = seal(/\${[\w\W]*/g);
  DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
  ARIA_ATTR = seal(/^aria-[\-\w]+$/);
  IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
  IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
  ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
  DOCTYPE_NAME = seal(/^html$/i);
  CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
  ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
  COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
  FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
  SELF_CLOSING_TAG = seal(/\/>/i);
  NODE_TYPE = {
    element: 1,
    attribute: 2,
    text: 3,
    cdataSection: 4,
    entityReference: 5,
    entityNode: 6,
    processingInstruction: 7,
    comment: 8,
    document: 9,
    documentType: 10,
    documentFragment: 11,
    notation: 12
  };
  purify = createDOMPurify();
});

// src/core/render/seal-policy.ts
var SEALED_FORBID_TAGS;
var init_seal_policy = __esm(() => {
  SEALED_FORBID_TAGS = [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "link",
    "meta",
    "base",
    "frame",
    "frameset"
  ];
});

// src/ui/components/sealed-html-preview/backdrop-css.ts
function sanitizeBackdropCss(raw) {
  if (!raw)
    return "";
  let s = raw.length > BACKDROP_CSS_CAP ? raw.slice(0, BACKDROP_CSS_CAP) : raw;
  s = s.replace(CLOSE_STYLE, "/*blocked-close-style*/");
  s = s.replace(/<[^>]*>/g, "/*blocked-tag*/");
  s = s.replace(/@import\b[^;]+;?/gi, "");
  s = s.replace(/@font-face\s*\{[\s\S]*?\}/gi, "");
  s = s.replace(/expression\s*\(/gi, "/*blocked*/(");
  s = s.replace(/behavior\s*:/gi, "/*blocked*/:");
  s = s.replace(/-moz-binding\s*:/gi, "/*blocked*/:");
  s = s.replace(/url\s*\(\s*['"]?\s*(?!data:)[^)]+\)/gi, "url(about:blank)");
  s = s.replace(/https?:\/\/[^\s"'()<>]+/gi, "about:blank");
  return `${s}
html,body{margin:0;padding:0;max-width:100%;overflow:auto;}
`;
}
var BACKDROP_CSS_CAP = 1e5, CLOSE_STYLE;
var init_backdrop_css = __esm(() => {
  CLOSE_STYLE = /<\s*\/\s*style\b[^>]*>?/gi;
});

// src/ui/components/sealed-html-preview/styles.module.css
var styles_module_default;
var init_styles_module = __esm(() => {
  styles_module_default = {
    frame: "frame_vzhnqg",
    fill: "fill_vzhnqg"
  };
});

// src/ui/components/sealed-html-preview/index.tsx
var exports_sealed_html_preview = {};
__export(exports_sealed_html_preview, {
  sanitizeBackdropCss: () => sanitizeBackdropCss,
  extractStyleBlocks: () => extractStyleBlocks,
  buildBackdropSrcDoc: () => buildBackdropSrcDoc,
  SealedHtmlPreview: () => SealedHtmlPreview,
  SEALED_PREVIEW_CSP: () => SEALED_PREVIEW_CSP,
  BACKDROP_HTML_CAP: () => BACKDROP_HTML_CAP
});
import { useEffect as useEffect6, useMemo as useMemo2, useRef as useRef5 } from "react";
import { jsxDEV as jsxDEV7 } from "react/jsx-dev-runtime";
function sanitizer() {
  const view = globalThis.window;
  if (view === undefined || view === null) {
    throw new Error("sealed preview: cannot sanitize without a DOM");
  }
  if (!purifier || boundTo !== view) {
    purifier = purify(view);
    boundTo = view;
  }
  return purifier;
}
function extractStyleBlocks(html2) {
  const found = [];
  const markup = html2.replace(STYLE_BLOCK, (_match, body) => {
    found.push(body);
    return "";
  });
  return { markup, css: found.join(`
`) };
}
function buildBackdropSrcDoc(html2, css = "") {
  const cappedHtml = html2.length > BACKDROP_HTML_CAP ? html2.slice(0, BACKDROP_HTML_CAP) : html2 || "";
  const { markup, css: documentCss } = extractStyleBlocks(cappedHtml);
  const cleanHtml = sanitizer().sanitize(markup, {
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"]
  });
  const cleanCss = sanitizeBackdropCss([css, documentCss].filter((part) => part !== "").join(`
`));
  return `<!doctype html><html><head>` + `<meta charset="utf-8"/>` + `<meta http-equiv="Content-Security-Policy" content="${SEALED_PREVIEW_CSP}"/>` + `<style>${cleanCss}</style>` + `</head><body>${cleanHtml}</body></html>`;
}
function useFocusStaysOutside(ref) {
  useEffect6(() => {
    let queued = 0;
    const onBlur = () => {
      if (document.activeElement !== ref.current)
        return;
      queued = window.setTimeout(() => {
        if (document.activeElement === ref.current)
          ref.current?.blur();
      }, 0);
    };
    window.addEventListener("blur", onBlur);
    return () => {
      window.clearTimeout(queued);
      window.removeEventListener("blur", onBlur);
    };
  }, [ref]);
}
function SealedHtmlPreview({
  html: html2,
  css = "",
  title = "Backdrop preview",
  fill = false
}) {
  const srcDoc = useMemo2(() => buildBackdropSrcDoc(html2, css), [html2, css]);
  const frameRef = useRef5(null);
  useFocusStaysOutside(frameRef);
  return /* @__PURE__ */ jsxDEV7("iframe", {
    ref: frameRef,
    tabIndex: -1,
    className: fill ? `${styles_module_default.frame} ${styles_module_default.fill}` : styles_module_default.frame,
    title,
    sandbox: "",
    srcDoc,
    referrerPolicy: "no-referrer"
  }, undefined, false, undefined, this);
}
var BACKDROP_HTML_CAP = 200000, FORBID_TAGS, SEALED_PREVIEW_CSP, purifier = null, boundTo = null, STYLE_BLOCK;
var init_sealed_html_preview = __esm(() => {
  init_purify_es();
  init_seal_policy();
  init_backdrop_css();
  init_styles_module();
  init_backdrop_css();
  FORBID_TAGS = [...SEALED_FORBID_TAGS];
  SEALED_PREVIEW_CSP = "default-src 'none'; img-src data: blob:; media-src data: blob:; " + "style-src 'unsafe-inline'; script-src 'none'; font-src 'none'; connect-src 'none'; " + "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi;
});

// src/ui/apps/agent/room.tsx
import { useCallback as useCallback7, useEffect as useEffect11, useMemo as useMemo6, useRef as useRef6, useState as useState12 } from "react";

// src/ui/agent/surface.ts
function readSurface(app, state) {
  const surface = app.agentSurface;
  return {
    appId: app.id,
    title: app.title,
    describe: surface?.describe ?? `${app.title}. This screen has not described itself.`,
    actions: surface?.actions ?? [],
    state
  };
}
function safeText(value, cap = 120) {
  const flat = value.replace(/[\u0000-\u001F\u007F-\u009F]+/gu, " ").replace(/[\u2028\u2029]+/gu, " ").replace(/\s+/gu, " ").trim();
  return flat.length > cap ? `${flat.slice(0, cap)}...` : flat;
}
function briefText(reading, itemCap = 12) {
  const lines = [`You are on ${safeText(reading.title, 60)}. ${safeText(reading.describe, 300)}`];
  if (reading.state) {
    lines.push(safeText(reading.state.headline, 300));
    const items = reading.state.items ?? [];
    if (items.length > 0) {
      const shown = items.slice(0, itemCap);
      lines.push(items.length > shown.length ? `Showing ${String(shown.length)} of ${String(items.length)}:` : `On screen:`);
      for (const item of shown) {
        const marks = [item.focused ? "focused" : null, item.dirty ? "unsaved changes" : null].filter((m) => m !== null);
        const where = `${safeText(item.kind, 40)}/${safeText(item.id, 80)}`;
        lines.push(`  ${where} "${safeText(item.name)}"${marks.length ? ` (${marks.join(", ")})` : ""}`);
      }
    }
    for (const note of reading.state.notes ?? [])
      lines.push(safeText(note, 400));
  }
  if (reading.actions.length > 0) {
    lines.push("Worth reaching for here:");
    for (const action of reading.actions) {
      lines.push(`  ${safeText(action.id, 40)}: ${safeText(action.describe, 200)}`);
    }
    lines.push("These are suggestions, not limits. You can work anywhere in the studio.");
  }
  return lines.join(`
`);
}

// src/ui/agent/use-agent-chat.ts
import { useCallback as useCallback2, useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";

// src/kit/commands/command.ts
function nearestCommand(commands, word) {
  const needle = word.toLowerCase().replace(/^\/+/, "");
  if (!needle)
    return null;
  const names = (command) => [command.name, ...command.aliases ?? []].map((n) => n.replace(/^\/+/, ""));
  for (const test of [
    (n) => n.startsWith(needle) || needle.startsWith(n),
    (n) => n.includes(needle) || needle.includes(n),
    (n) => oneEditApart(n, needle)
  ]) {
    const hit = commands.find((command) => names(command).some(test));
    if (hit)
      return hit;
  }
  return null;
}
function oneEditApart(a, b) {
  if (Math.abs(a.length - b.length) > 1)
    return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let slack = 1;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (slack-- === 0)
      return false;
    if (short.length === long.length)
      i += 1;
    j += 1;
  }
  return true;
}
var matchCommand = (commands, raw) => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/"))
    return null;
  const space = trimmed.search(/\s/);
  const word = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase();
  const arg = space === -1 ? "" : trimmed.slice(space + 1).trim();
  const command = commands.find((c) => c.name === word || c.aliases?.includes(word));
  return command ? { command, arg } : null;
};

// src/ui/agent/stream-turn.ts
async function readTurnStream(response, on) {
  if (!response.body) {
    on.onFailed?.("The server sent no stream.");
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  try {
    for (;; ) {
      const { done, value } = await reader.read();
      if (done)
        break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(`

`);
      buffer = frames.pop() ?? "";
      for (const frame of frames)
        dispatch(frame, on);
    }
    if (buffer.trim())
      dispatch(buffer, on);
  } catch (error) {
    const name = error.name;
    if (name === "AbortError")
      on.onStopped?.("Stopped.");
    else
      on.onFailed?.(error instanceof Error ? error.message : String(error));
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}
function dispatch(frame, on) {
  let event = "";
  let raw = "";
  for (const line of frame.split(`
`)) {
    if (line.startsWith("event: "))
      event = line.slice(7).trim();
    else if (line.startsWith("data: "))
      raw = line.slice(6);
  }
  if (!event)
    return;
  let data = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (typeof parsed === "object" && parsed !== null)
      data = parsed;
  } catch {
    return;
  }
  const str = (key) => typeof data[key] === "string" ? data[key] : "";
  switch (event) {
    case "delta":
      on.onDelta?.(data["kind"] === "reasoning" ? "reasoning" : "text", str("text"));
      return;
    case "say":
      on.onSay?.(str("text"));
      return;
    case "tool-start":
      on.onToolStart?.(str("name"));
      return;
    case "begin":
    case "session": {
      const id = str("sessionId") || str("id");
      if (id)
        on.onSession?.(id);
      if (data["saved"] === false)
        on.onUnsaved?.(str("why"));
      return;
    }
    case "tool": {
      on.onTool?.(str("name"), str("summary"), data["choices"]);
      const show = data["show"];
      if (show !== null && typeof show === "object") {
        const piece = show;
        if (typeof piece.kind === "string" && typeof piece.id === "string") {
          on.onShow?.({ kind: piece.kind, id: piece.id });
        }
      }
      return;
    }
    case "wrote":
      on.onWrote?.(str("kind"), str("id"));
      return;
    case "gate":
      on.onGate?.(data);
      return;
    case "usage":
      on.onUsage?.(data["usage"]);
      return;
    case "model":
      on.onModel?.(str("label"));
      return;
    case "stopped": {
      const recovery = str("recovery");
      on.onStopped?.(str("reason"), recovery || undefined);
      return;
    }
    case "failed":
      on.onFailed?.(str("error"));
      return;
    default:
      return;
  }
}

// src/ui/agent/kit-choice-core.ts
var MIN_OPTIONS = 2;
var MAX_OPTIONS = 12;
var MAX_QUESTION = 200;
var MAX_VALUE = 200;
var MAX_NOTE = 200;
var text = (value, cap) => typeof value === "string" ? value.trim().slice(0, cap) : "";
function readChoices(raw) {
  if (typeof raw !== "object" || raw === null)
    return null;
  const record = raw;
  const question = text(record["question"], MAX_QUESTION);
  if (!question)
    return null;
  if (!Array.isArray(record["options"]))
    return null;
  const options = [];
  for (const entry of record["options"].slice(0, MAX_OPTIONS)) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const option = entry;
    const value = text(option["value"], MAX_VALUE);
    if (!value)
      continue;
    const note = text(option["note"], MAX_NOTE);
    options.push(note ? { value, note } : { value });
  }
  return options.length >= MIN_OPTIONS ? { question, options } : null;
}

// src/kit/providers/usage.ts
var EMPTY_USAGE = {
  input: 0,
  output: 0,
  total: 0,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0
};
var clean = (n) => typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
var readUsage = (raw) => {
  const input = clean(raw.input);
  const output = clean(raw.output);
  const total = clean(raw.total) || input + output;
  return {
    input,
    output,
    total,
    cacheRead: clean(raw.cacheRead),
    cacheWrite: clean(raw.cacheWrite),
    reasoning: clean(raw.reasoning)
  };
};
var addUsage = (a, b) => ({
  input: a.input + b.input,
  output: a.output + b.output,
  total: a.total + b.total,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  reasoning: a.reasoning + b.reasoning
});

// src/ui/agent/kit-meters-core.ts
var BAR_WIDTH = 18;
var ZONE_INK = {
  calm: "var(--kit-teal)",
  warn: "var(--kit-gold)",
  crit: "var(--kit-rose)"
};
var NO_TOKENS = { turn: EMPTY_USAGE, session: EMPTY_USAGE };
function foldUsage(prior, raw) {
  const record = typeof raw === "object" && raw !== null ? raw : {};
  const num = (key) => typeof record[key] === "number" ? record[key] : undefined;
  const turn = readUsage({
    ...num("input") === undefined ? {} : { input: num("input") },
    ...num("output") === undefined ? {} : { output: num("output") },
    ...num("total") === undefined ? {} : { total: num("total") },
    ...num("reasoning") === undefined ? {} : { reasoning: num("reasoning") },
    ...num("cacheRead") === undefined ? {} : { cacheRead: num("cacheRead") },
    ...num("cacheWrite") === undefined ? {} : { cacheWrite: num("cacheWrite") }
  });
  return { turn, session: addUsage(prior.session, turn) };
}
function contextConsumed(tokens) {
  return tokens.turn.input;
}

// src/ui/_shared/web-storage.ts
var volatile = new Map;
function webStorage(area) {
  const transient = volatile.get(area);
  if (transient)
    return transient;
  if (typeof globalThis === "undefined")
    return null;
  try {
    return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

// src/ui/_shared/window-memory.ts
var TRANSCRIPT_KEY = "hoplight.agent.transcript";
var AGENT_SESSION_KEY = "hoplight.agent.session";
var QUEUE_KEY = "hoplight.agent.queue";
function readAgentSessionId() {
  try {
    return webStorage("session")?.getItem(AGENT_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

// src/ui/agent/command-core.ts
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (v) => typeof v === "string" && v ? v : undefined;
function asKitCommands(catalog) {
  return catalog.map((info) => ({
    name: info.name,
    ...info.aliases ? { aliases: info.aliases } : {},
    summary: info.summary,
    ...info.group ? { group: info.group } : {},
    run: () => false
  }));
}
function parseCatalog(value) {
  const raw = isRecord(value) ? value["commands"] : undefined;
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    const name = str(item["name"]);
    const summary = str(item["summary"]);
    if (!name || !name.startsWith("/") || !summary)
      continue;
    const aliases = Array.isArray(item["aliases"]) ? item["aliases"].filter((a) => typeof a === "string" && a.startsWith("/")) : [];
    const group = str(item["group"]);
    out.push({
      name,
      ...aliases.length > 0 ? { aliases } : {},
      summary,
      ...group ? { group } : {},
      completes: item["completes"] === true
    });
  }
  return out;
}
function parseSuggestions(value) {
  const raw = isRecord(value) ? value["suggestions"] : undefined;
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    const text2 = str(item["value"]);
    if (!text2)
      continue;
    const note = str(item["note"]);
    out.push({ value: text2, ...note ? { note } : {} });
  }
  return out;
}
var parseRows = (raw) => {
  if (!Array.isArray(raw))
    return [];
  const rows = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    const label = str(item["label"]);
    if (!label)
      continue;
    const note = str(item["note"]);
    const send = str(item["send"]);
    const keep = item["keep"];
    rows.push({
      label,
      ...note ? { note } : {},
      ...send ? { send } : {},
      ...typeof keep === "number" && Number.isInteger(keep) && keep >= 0 ? { keep } : {}
    });
  }
  return rows;
};
var parseDoctorRows = (raw) => {
  if (!Array.isArray(raw))
    return [];
  const rows = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    const label = str(item["label"]);
    const status = item["status"];
    if (!label || status !== "ok" && status !== "warn" && status !== "fail")
      continue;
    rows.push({ label, status, detail: str(item["detail"]) ?? "" });
  }
  return rows;
};
var parseImages = (raw) => {
  if (!Array.isArray(raw))
    return [];
  const images = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    const src = str(item["src"]);
    if (!src || !src.startsWith("data:image/"))
      continue;
    const caption = str(item["caption"]);
    images.push({ src, ...caption ? { caption } : {} });
  }
  return images;
};
var parseTranscriptLines = (raw) => {
  if (!Array.isArray(raw))
    return [];
  const lines = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    const role = item["role"];
    const text2 = item["text"];
    if (role !== "user" && role !== "assistant" || typeof text2 !== "string")
      continue;
    lines.push({ role, text: text2 });
  }
  return lines;
};
function parseWidget(value) {
  if (!isRecord(value))
    return null;
  switch (value["kind"]) {
    case "rows": {
      const hint = str(value["hint"]);
      return { kind: "rows", rows: parseRows(value["rows"]), ...hint ? { hint } : {} };
    }
    case "doctor":
      return { kind: "doctor", rows: parseDoctorRows(value["rows"]) };
    case "images": {
      const images = parseImages(value["images"]);
      return images.length > 0 ? { kind: "images", images } : null;
    }
    default:
      return null;
  }
}
function parseEffects(value) {
  const raw = isRecord(value) ? value["effects"] : undefined;
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const item of raw) {
    if (!isRecord(item))
      continue;
    switch (item["kind"]) {
      case "say": {
        const text2 = str(item["text"]);
        if (text2)
          out.push({ kind: "say", text: text2 });
        break;
      }
      case "rows": {
        const rows = parseRows(item["rows"]);
        const hint = str(item["hint"]);
        out.push({ kind: "rows", title: str(item["title"]) ?? "", rows, ...hint ? { hint } : {} });
        break;
      }
      case "doctor":
        out.push({ kind: "doctor", rows: parseDoctorRows(item["rows"]) });
        break;
      case "images": {
        const images = parseImages(item["images"]);
        if (images.length > 0)
          out.push({ kind: "images", title: str(item["title"]) ?? "", images });
        break;
      }
      case "transcript":
        out.push({ kind: "transcript", lines: parseTranscriptLines(item["lines"]) });
        break;
      case "open": {
        const piece = isRecord(item["piece"]) ? item["piece"] : {};
        const kind = str(piece["kind"]);
        const id = str(piece["id"]);
        if (kind && id)
          out.push({ kind: "open", piece: { kind, id } });
        break;
      }
      case "session": {
        const id = str(item["id"]);
        if (id)
          out.push({ kind: "session", id });
        break;
      }
      case "settings":
        out.push({ kind: "settings" });
        break;
      case "close":
        out.push({ kind: "close" });
        break;
      default:
        break;
    }
  }
  return out;
}
function keepTurns(lines, keep) {
  if (keep <= 0)
    return [];
  let seen = 0;
  for (let at = 0;at < lines.length; at += 1) {
    if (lines[at]?.role !== "user")
      continue;
    seen += 1;
    if (seen > keep)
      return lines.slice(0, at);
  }
  return [...lines];
}
function kitLineFor(effect) {
  switch (effect.kind) {
    case "say":
      return { role: "kit", text: effect.text };
    case "rows":
      return { role: "kit", text: effect.title, widget: { kind: "rows", rows: effect.rows, ...effect.hint ? { hint: effect.hint } : {} } };
    case "doctor":
      return { role: "kit", text: "Doctor", widget: { kind: "doctor", rows: effect.rows } };
    case "images":
      return { role: "kit", text: effect.title, widget: { kind: "images", images: effect.images } };
    default:
      return null;
  }
}

// src/ui/agent/transcript-store.ts
var KEY = TRANSCRIPT_KEY;
var MAX_LINES = 200;
var MAX_CHARS = 200000;
var isLine = (v) => typeof v === "object" && v !== null && typeof v.text === "string" && ["user", "assistant", "tool", "kit"].includes(v.role);
var restore = (line) => {
  const asked = readChoices(line.choices);
  const widget = parseWidget(line.widget);
  return {
    role: line.role,
    text: line.text,
    ...typeof line.tool === "string" ? { tool: line.tool } : {},
    ...asked ? { choices: asked } : {},
    ...widget ? { widget } : {},
    ...typeof line.answered === "string" ? { answered: line.answered } : {},
    ...typeof line.open === "boolean" ? { open: line.open } : {}
  };
};
var forStorage = (line) => {
  if (line.widget?.kind !== "images")
    return line;
  const { widget: _dropped, ...rest } = line;
  return rest;
};
function loadTranscript() {
  try {
    const raw = webStorage("session")?.getItem(KEY);
    if (!raw)
      return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLine).map(restore) : [];
  } catch {
    return [];
  }
}
function saveTranscript(lines) {
  try {
    let keep = lines.slice(-MAX_LINES).map(forStorage);
    while (keep.length > 1 && keep.reduce((n, l) => n + l.text.length, 0) > MAX_CHARS) {
      keep = keep.slice(1);
    }
    webStorage("session")?.setItem(KEY, JSON.stringify(keep));
  } catch {}
}
var DRAFT_KEY = `${TRANSCRIPT_KEY}.draft`;
function loadDraft() {
  try {
    const raw = webStorage("session")?.getItem(DRAFT_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}
function saveDraft(text2) {
  try {
    if (text2)
      webStorage("session")?.setItem(DRAFT_KEY, text2);
    else
      webStorage("session")?.removeItem(DRAFT_KEY);
  } catch {}
}

// src/ui/agent/slash-core.ts
function slashQuery(draft) {
  if (draft.includes(`
`))
    return null;
  const text2 = draft.replace(/^\s+/, "");
  if (!text2.startsWith("/") || text2.startsWith("//"))
    return null;
  const space = text2.search(/\s/);
  if (space === -1)
    return { word: text2.toLowerCase(), arg: null };
  return { word: text2.slice(0, space).toLowerCase(), arg: text2.slice(space + 1) };
}
function commandMatches(catalog, word) {
  const needle = word.replace(/^\/+/, "").toLowerCase();
  if (!needle)
    return [...catalog];
  const hits = (info, names) => names.some((n) => n.replace(/^\/+/, "").toLowerCase().startsWith(needle)) && info.name !== "";
  const byName = catalog.filter((info) => hits(info, [info.name]));
  const byAlias = catalog.filter((info) => !byName.includes(info) && hits(info, info.aliases ?? []));
  return [...byName, ...byAlias];
}
function exactCommand(catalog, word) {
  const typed = word.toLowerCase();
  return catalog.find((info) => info.name === typed || info.aliases?.includes(typed));
}
function wordStageChoices(catalog, word) {
  return exactCommand(catalog, word) ? [] : commandMatches(catalog, word);
}
function draftForPick(info) {
  return info.completes ? `${info.name} ` : info.name;
}
function draftForArg(word, value) {
  return `${word} ${value}`;
}
function argStageChoices(candidates, arg) {
  const typed = arg.trim();
  return candidates.filter((one) => one.value !== typed);
}
function unknownNote(catalog, word) {
  const near = nearestCommand(asKitCommands(catalog), word);
  return near ? `Unknown command: ${word}. Did you mean ${near.name}? It ${near.summary}.` : `Unknown command: ${word}. Try /help.`;
}
function nextIndex(current, count, step) {
  if (count <= 0)
    return 0;
  return ((current + step) % count + count) % count;
}

// src/ui/agent/use-queue.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// src/kit/render/primitives/composer/queue.ts
var MAX_QUEUED = 20;
function appendQueued(queue, item) {
  if (!item.trim() || queue.length >= MAX_QUEUED) {
    return { accepted: false, queue: [...queue] };
  }
  return { accepted: true, queue: [...queue, item] };
}
function dequeueQueued(queue) {
  if (queue.length === 0)
    return { item: null, queue: [] };
  return { item: queue[0] ?? null, queue: queue.slice(1) };
}

// src/ui/agent/use-queue.ts
function useQueueDrain(input) {
  const { queue, busy, blocked, send, brief, stop } = input;
  useEffect(() => {
    if (busy || blocked || queue.items.length === 0)
      return;
    const next = queue.take();
    if (next !== null)
      send.current(next, brief.current);
  }, [busy, blocked, queue, send, brief]);
  return {
    queued: queue.items,
    dropQueued: queue.drop,
    sendQueuedNow: useCallback((at) => {
      const held = queue.claim(at);
      if (held !== null) {
        stop();
        send.current(held, brief.current);
      }
    }, [queue, stop, send, brief])
  };
}
var read = () => {
  try {
    const raw = webStorage("session")?.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};
function useQueue() {
  const [items, setItems] = useState(read);
  const current = useRef(items);
  const replace = useCallback((next) => {
    current.current = next;
    setItems(next);
  }, []);
  useEffect(() => {
    try {
      webStorage("session")?.setItem(QUEUE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);
  const add = useCallback((text2) => {
    const next = appendQueued(current.current, text2);
    if (next.accepted)
      replace(next.queue);
    return next.accepted;
  }, [replace]);
  const take = useCallback(() => {
    const next = dequeueQueued(current.current);
    replace(next.queue);
    return next.item;
  }, [replace]);
  const drop = useCallback((at) => {
    replace(current.current.filter((_, i) => i !== at));
  }, [replace]);
  const claim = useCallback((at) => {
    const held = current.current[at] ?? null;
    if (held !== null)
      replace(current.current.filter((_, i) => i !== at));
    return held;
  }, [replace]);
  return useMemo(() => ({ items, add, take, drop, claim }), [items, add, take, drop, claim]);
}

// src/ui/agent/use-agent-chat.ts
function useAgentChat(post, postGate, slash) {
  const [lines, setLines] = useState2(() => loadTranscript());
  const [streaming, setStreaming] = useState2("");
  const [busy, setBusy] = useState2(false);
  const [gate, setGate] = useState2(null);
  const [problem, setProblem] = useState2(null);
  const [tokens, setTokens] = useState2(NO_TOKENS);
  const [rehearsal, setRehearsal] = useState2("");
  const [trace, setTrace] = useState2(null);
  const [startedAt, setStartedAt] = useState2(0);
  const linesRef = useRef2(lines);
  linesRef.current = lines;
  const busyRef = useRef2(false);
  const slashRef = useRef2(slash);
  slashRef.current = slash;
  const sessionIdRef = useRef2(readAgentSessionId());
  const abortRef = useRef2(null);
  const queue = useQueue();
  useEffect2(() => {
    saveTranscript(lines);
  }, [lines]);
  const sendTurn = useCallback2(async (text2, brief, images) => {
    const trimmed = text2.trim();
    if (!trimmed && !images?.length)
      return;
    if (busyRef.current)
      return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    setStreaming("");
    setTokens((prior) => ({ ...NO_TOKENS, session: prior.session }));
    const conversation = [...linesRef.current, { role: "user", text: trimmed }];
    setLines((prior) => [...prior, { role: "user", text: trimmed }]);
    const controller = new AbortController;
    abortRef.current = controller;
    let sofar = "";
    let thinking = "";
    const began = Date.now();
    setStartedAt(began);
    setRehearsal("");
    setTrace(null);
    try {
      const response = await post({
        messages: conversation.filter((l) => l.role === "user" || l.role === "assistant").map((l) => ({ role: l.role, content: l.text })),
        ...brief ? { brief } : {},
        ...sessionIdRef.current ? { sessionId: sessionIdRef.current } : {},
        ...images?.length ? { images } : {}
      }, controller.signal);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setProblem(body?.error ?? `The server refused the turn (${String(response.status)}).`);
        return;
      }
      await readTurnStream(response, {
        onDelta: (kind, text3) => {
          if (kind === "reasoning") {
            thinking += text3;
            setRehearsal(thinking);
            return;
          }
          sofar += text3;
          setStreaming(sofar);
        },
        onSay: (text3) => {
          const said = text3.trim() || sofar.trim();
          sofar = "";
          setStreaming("");
          if (said)
            setLines((prior) => [...prior, { role: "assistant", text: said }]);
        },
        onToolStart: (name) => {
          setLines((prior) => [...prior, { role: "tool", text: `${name}...`, tool: name }]);
        },
        onShow: (piece) => {
          slashRef.current?.shell({ kind: "open", piece });
        },
        onSession: (id) => {
          sessionIdRef.current = id;
          try {
            webStorage("session")?.setItem(AGENT_SESSION_KEY, id);
          } catch {}
        },
        onUnsaved: (why) => {
          setProblem(`This turn was not saved: ${why}`);
        },
        onTool: (name, summary, choices) => {
          const asked = readChoices(choices);
          setLines((prior) => {
            const line = {
              role: "tool",
              text: `${name}: ${summary}`,
              tool: name,
              ...asked ? { choices: asked } : {}
            };
            const waiting2 = `${name}...`;
            for (let at = prior.length - 1;at >= 0; at--) {
              const row = prior[at];
              if (row?.role === "tool" && row.text === waiting2) {
                const next = [...prior];
                next[at] = line;
                return next;
              }
            }
            return [...prior, line];
          });
        },
        onGate: (request) => {
          setGate(request);
        },
        onUsage: (u) => {
          setTokens((prior) => foldUsage(prior, u));
        },
        onStopped: (reason, recovery) => {
          setProblem(recovery ? `${reason} ${recovery}` : reason);
        },
        onFailed: (error) => {
          setProblem(error);
        }
      });
      if (sofar.trim()) {
        setLines((prior) => [...prior, { role: "assistant", text: sofar.trim() }]);
        setStreaming("");
      }
      if (thinking.trim()) {
        setTrace({ text: thinking.trim(), seconds: (Date.now() - began) / 1000 });
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      setBusy(false);
      setRehearsal("");
      setGate(null);
    }
  }, [post]);
  const runCommandLine = useCallback2(async (line) => {
    if (!slash || busyRef.current)
      return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const effects = await slash.run(line, linesRef.current.filter((l) => l.role === "user" || l.role === "assistant").map((l) => ({ role: l.role, content: l.text })));
      for (const effect of effects) {
        if (effect.kind === "transcript") {
          setLines(effect.lines.map((l) => ({ role: l.role, text: l.text })));
          continue;
        }
        if (effect.kind === "session") {
          sessionIdRef.current = effect.id;
          try {
            webStorage("session")?.setItem(AGENT_SESSION_KEY, effect.id);
          } catch {}
          continue;
        }
        const drawn = kitLineFor(effect);
        if (drawn) {
          setLines((prior) => [...prior, drawn]);
          continue;
        }
        slash.shell(effect);
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [slash]);
  const sendRef = useRef2(async () => {});
  const briefRef = useRef2(undefined);
  const send = useCallback2(async (text2, brief) => {
    const trimmed = text2.trim();
    if (!trimmed)
      return;
    if (busyRef.current) {
      if (!queue.add(trimmed)) {
        setProblem("The queue is full. Send this once a turn has finished.");
      }
      return;
    }
    if (trimmed.startsWith("//"))
      return sendTurn(trimmed.slice(1), brief);
    if (slash && trimmed.startsWith("/")) {
      const matched = matchCommand(slash.commands, trimmed);
      if (!matched) {
        setLines((prior) => [...prior, { role: "kit", text: unknownNote(slash.catalog, trimmed.split(/\s/, 1)[0] ?? trimmed) }]);
        return;
      }
      return runCommandLine(trimmed);
    }
    return sendTurn(trimmed, brief);
  }, [slash, runCommandLine, sendTurn, queue]);
  const answerGate = useCallback2((choice) => {
    const open = gate;
    if (!open)
      return;
    setGate(null);
    postGate({ id: open.id, ...choice }).catch(() => {
      setProblem("That answer did not reach the agent. The change was not made.");
    });
  }, [gate, postGate]);
  const setFold = useCallback2((index, open) => {
    setLines((prior) => prior.map((line, at) => at === index ? { ...line, open } : line));
  }, []);
  const answerChoice = useCallback2((index, message, brief) => {
    if (busyRef.current)
      return;
    setLines((prior) => prior.map((line, at) => at === index ? { ...line, answered: message } : line));
    sendTurn(message, brief);
  }, [sendTurn]);
  const stop = useCallback2(() => {
    abortRef.current?.abort();
  }, []);
  const rewind = useCallback2((keep) => {
    if (busyRef.current)
      return;
    setLines((prior) => keepTurns(prior, keep));
  }, []);
  const clear = useCallback2(() => {
    setLines([]);
    setProblem(null);
    setStreaming("");
    setTokens(NO_TOKENS);
  }, []);
  sendRef.current = send;
  const waiting = useQueueDrain({ queue, busy, blocked: gate !== null, send: sendRef, brief: briefRef, stop });
  return {
    lines,
    streaming,
    busy,
    gate,
    problem,
    tokens,
    rehearsal,
    trace,
    startedAt,
    send,
    answerGate,
    setFold,
    answerChoice,
    stop,
    rewind,
    clear,
    ...waiting
  };
}

// src/ui/agent/use-studio-changes.ts
import { useEffect as useEffect3, useRef as useRef3, useState as useState3 } from "react";

// src/browser-mode.ts
function isBrowserStudio(doc = typeof document === "undefined" ? undefined : document) {
  return doc?.querySelector('meta[name="hoplight-runtime"]')?.getAttribute("content") === "browser";
}
var BROWSER_STUDIO_CHANGE_EVENT = "hoplight:studio-change";
// src/ui/agent/use-studio-changes.ts
function useStudioChanges(connect = (url) => new EventSource(url)) {
  const [version, setVersion] = useState3(0);
  const [kinds, setKinds] = useState3([]);
  const [watching, setWatching] = useState3(false);
  const connectRef = useRef3(connect);
  connectRef.current = connect;
  useEffect3(() => {
    if (isBrowserStudio()) {
      const changed = (event) => {
        const detail = event.detail;
        setKinds(Array.isArray(detail?.kinds) ? detail.kinds.filter((kind) => typeof kind === "string") : []);
        setVersion((current) => current + 1);
      };
      window.addEventListener(BROWSER_STUDIO_CHANGE_EVENT, changed);
      return () => window.removeEventListener(BROWSER_STUDIO_CHANGE_EVENT, changed);
    }
    let source = null;
    let retry = null;
    let live = true;
    let failures = 0;
    let everReady = false;
    const scheduleRetry = () => {
      if (!live || retry)
        return;
      failures++;
      if (!everReady && failures >= 3)
        return;
      if (failures > 8)
        return;
      const wait = Math.min(3000 * 2 ** (failures - 1), 60000);
      retry = setTimeout(() => {
        retry = null;
        open();
      }, wait);
    };
    const open = () => {
      if (!live)
        return;
      try {
        source = connectRef.current("/api/agent/events");
      } catch {
        setWatching(false);
        scheduleRetry();
        return;
      }
      source.addEventListener("ready", () => {
        setWatching(true);
        failures = 0;
        if (everReady)
          setVersion((n) => n + 1);
        everReady = true;
      });
      source.addEventListener("degraded", () => {
        setWatching(false);
      });
      source.addEventListener("changed", (event) => {
        try {
          const data = JSON.parse(event.data);
          setKinds(Array.isArray(data.kinds) ? data.kinds.filter((k) => typeof k === "string") : []);
        } catch {
          setKinds([]);
        }
        setVersion((n) => n + 1);
      });
      source.addEventListener("error", () => {
        setWatching(false);
        source?.close();
        source = null;
        scheduleRetry();
      });
    };
    open();
    return () => {
      live = false;
      if (retry)
        clearTimeout(retry);
      source?.close();
    };
  }, []);
  return { version, kinds, watching };
}

// src/ui/agent/gate-card.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
var asLines = (value) => Array.isArray(value) ? value.filter((l) => typeof l === "string") : [];
function GateCard({
  request,
  busy,
  onAnswer
}) {
  if (!request)
    return null;
  const warnings = asLines(request.review?.warnings);
  const detail = [
    ...asLines(request.review?.lines),
    ...asLines(request.crossing?.lines),
    ...asLines(request.peek?.lines)
  ];
  const title = request.review?.title ?? request.peek?.title ?? request.name ?? "a change";
  return /* @__PURE__ */ jsxDEV("section", {
    className: "gate-card",
    role: "alertdialog",
    "aria-labelledby": "gate-card-title",
    children: [
      /* @__PURE__ */ jsxDEV("p", {
        className: "gate-card__kick",
        children: [
          request.name ? `${request.name} · ` : "",
          request.verdict?.level ?? "review"
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("strong", {
        id: "gate-card__title",
        className: "gate-card__title",
        children: title
      }, undefined, false, undefined, this),
      request.verdict?.why && /* @__PURE__ */ jsxDEV("p", {
        className: "gate-card__why",
        children: request.verdict.why
      }, undefined, false, undefined, this),
      warnings.length > 0 && /* @__PURE__ */ jsxDEV("ul", {
        className: "gate-card__warnings",
        children: warnings.map((w, i) => /* @__PURE__ */ jsxDEV("li", {
          children: w
        }, `w${String(i)}`, false, undefined, this))
      }, undefined, false, undefined, this),
      detail.length > 0 && /* @__PURE__ */ jsxDEV("pre", {
        className: "gate-card__detail",
        children: detail.join(`
`)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        className: "gate-card__row",
        children: [
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            className: "gate-card__yes",
            disabled: busy,
            onClick: () => {
              onAnswer({ type: "allow-once" });
            },
            children: "Allow once"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            disabled: busy,
            onClick: () => {
              onAnswer({ type: "allow-session" });
            },
            children: "Allow for this session"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            disabled: busy,
            onClick: () => {
              onAnswer({ type: "deny" });
            },
            children: "No"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            disabled: busy,
            onClick: () => {
              onAnswer({ type: "hold" });
            },
            children: "Wait, tell me more"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            className: "gate-card__abort",
            disabled: busy,
            onClick: () => {
              onAnswer({ type: "abort" });
            },
            children: "Stop the whole turn"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/_shared/session-marker.ts
var STALE_SESSION = "stale session";

// src/ui/_shared/api-fetch.ts
class ApiHttpError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}
var INSPECT_BODY_MAX_BYTES = 64 * 1024 * 1024;
var TOKEN_META = 'meta[name="vaude-session"]';
function readSessionToken(doc = document) {
  const el = doc.querySelector(TOKEN_META);
  const t = el?.getAttribute("content")?.trim() ?? "";
  return t;
}
async function apiFetch(path, init = {}) {
  const headers = { ...init.headers ?? {} };
  const requireToken = init.requireToken ?? (init.method !== undefined && init.method !== "GET");
  if (requireToken) {
    const token = readSessionToken();
    if (!token)
      throw new ApiHttpError(403, "missing session");
    headers["X-Hoplight-Token"] = token;
  }
  const { requireToken: _r, headers: _h, ...rest } = init;
  const res = await fetch(path, { ...rest, headers });
  return res;
}
async function apiFetchJson(path, init = {}) {
  const res = await apiFetch(path, init);
  const text2 = await res.text();
  let body = null;
  if (text2) {
    try {
      body = JSON.parse(text2);
    } catch {
      body = text2;
    }
  }
  if (!res.ok) {
    const msg = body && typeof body === "object" && typeof body.error === "string" ? body.error : `request failed (${res.status})`;
    if (res.status === 403 && msg === STALE_SESSION)
      reloadForNewSession();
    throw new ApiHttpError(res.status, msg);
  }
  return body;
}
var reloading = false;
function reloadForNewSession() {
  if (reloading)
    return;
  reloading = true;
  location.reload();
}

// src/kit/render/theme.ts
var theme = {
  well: "#0e0c10",
  recess: "#0b090d",
  floor: "#141217",
  panel: "#17161d",
  lift: "#272130",
  row: "#201d27",
  sunken: "#0b0a0e",
  edge: "#000000",
  seam: "#2b2833",
  line: "#4a4556",
  div: "#3a3444",
  text: "#f2eee9",
  bright: "#e4e4e7",
  soft: "#b3aabd",
  quiet: "#8f8a9b",
  mut: "#6a6472",
  rose: "#e11d48",
  roseDeep: "#b4092f",
  teal: "#2dd4bf",
  tealDeep: "#0f766e",
  gold: "#eab308",
  goldDim: "#4a3d10",
  violet: "#a78bfa",
  violetDeep: "#6d28d9",
  alive: "#22c55e",
  red: "#f16a6a",
  white: "#ffffff",
  stamp: "#2b2734",
  stampDim: "#141019"
};
var verbColor = {
  list: "#6aa5f0",
  read: "#5bd995",
  search: "#4fd6e0",
  triage: "#2dd4bf",
  inspect: "#7fb2f2",
  write: "#e8b64a",
  shelve: "#e8b64a",
  save: "#e8b64a",
  import: "#e8b64a",
  tag: "#e6c15c",
  edit: "#ef9f5a",
  delete: "#f16a6a",
  fetch: "#b79cf5",
  send: "#b79cf5"
};
var verbFallback = theme.bright;
var kindColor = {
  character: "#ef9aa4",
  characters: "#ef9aa4",
  lorebook: "#86bcdc",
  lorebooks: "#86bcdc",
  regex: "#b79cf5",
  preset: "#e6c15c",
  presets: "#e6c15c"
};

// src/ui/agent/kit-vars.ts
var SWEEP_DIM = "#140409";
var dashed = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
function kitVars() {
  const vars = {};
  for (const [name, value] of Object.entries(theme))
    vars[`--kit-${dashed(name)}`] = value;
  for (const [verb, value] of Object.entries(verbColor))
    vars[`--kit-verb-${verb}`] = value;
  for (const [kind, value] of Object.entries(kindColor))
    vars[`--kit-kind-${kind}`] = value;
  vars["--kit-sweep-dim"] = SWEEP_DIM;
  return vars;
}
function verbOf(toolName) {
  const verb = toolName.includes("_") ? toolName.split("_")[1] ?? "" : toolName;
  return verb && verb in verbColor ? `var(--kit-verb-${verb})` : "var(--kit-bright)";
}

// src/ui/agent/html-handoff.ts
var KEY2 = "hoplight.html-view.doc";
var OPEN_HTML_EVENT = "hoplight:open-html";
var HTML_VIEW_APP = "html-view";
var HANDOFF_CAP = 200000;
function put(handoff) {
  try {
    webStorage("session")?.setItem(KEY2, JSON.stringify(handoff));
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(OPEN_HTML_EVENT));
}
function handOffHtml(html) {
  put({ at: "inline", html: html.length > HANDOFF_CAP ? html.slice(0, HANDOFF_CAP) : html });
}
function onHtmlHandoff(run) {
  window.addEventListener(OPEN_HTML_EVENT, run);
  return () => window.removeEventListener(OPEN_HTML_EVENT, run);
}

// src/ui/agent/kit-widgets.tsx
import { useEffect as useEffect4, useState as useState4 } from "react";

// src/ui/agent/kit-widgets-core.ts
var STAGE_VERBS = ["cueing", "rifling", "staging", "rehearsing", "consulting"];
var BREATH_STEP_MS = 400;
var BREATH_INKS = ["--kit-mut", "--kit-rose-deep", "--kit-rose", "--kit-rose-deep"];
var VERB_HOLD_MS = 5200;
var DOT_STEP_MS = 800;
var REHEARSAL_TAIL = 380;
function clockText(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`;
}
function breathInk(elapsedMs) {
  const at = Math.max(0, Math.floor(elapsedMs / BREATH_STEP_MS));
  return `var(${BREATH_INKS[at % BREATH_INKS.length] ?? "--kit-rose"})`;
}
function stageLabel(elapsedMs) {
  const at = Math.max(0, elapsedMs);
  const verb = STAGE_VERBS[Math.floor(at / VERB_HOLD_MS) % STAGE_VERBS.length] ?? "cueing";
  const dots = ".".repeat(Math.floor(at / DOT_STEP_MS) % 3 + 1);
  return `${verb}${dots}`;
}
function rehearsalTail(text2, cap = REHEARSAL_TAIL) {
  const points = [...text2];
  return points.length <= cap ? text2 : points.slice(-cap).join("");
}
function traceSummary(seconds, chars) {
  return `rehearsed for ${String(Math.max(0, Math.round(seconds)))}s · ${String(chars)} chars · click to reopen`;
}

// src/ui/agent/kit-widgets.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
function useBeat(ms, on) {
  const [, tick] = useState4(0);
  useEffect4(() => {
    if (!on)
      return;
    const timer = setInterval(() => {
      tick((n) => n + 1);
    }, ms);
    return () => {
      clearInterval(timer);
    };
  }, [ms, on]);
}
function Stagehand({ startedAt }) {
  useBeat(200, true);
  const elapsed = Date.now() - startedAt;
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "kit-stagehand",
    children: [
      /* @__PURE__ */ jsxDEV2("span", {
        className: "kit-stagehand__dot",
        style: { color: breathInk(elapsed) },
        children: "·"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2("span", {
        className: "kit-stagehand__verb",
        children: stageLabel(elapsed)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2("span", {
        className: "kit-stamp",
        children: clockText(elapsed)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function Rehearsal({ text: text2, startedAt }) {
  useBeat(250, true);
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "kit-rehearsal",
    children: [
      /* @__PURE__ */ jsxDEV2("div", {
        className: "kit-rehearsal__head",
        children: [
          /* @__PURE__ */ jsxDEV2("span", {
            children: "REHEARSAL"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV2("span", {
            className: "kit-stamp",
            children: clockText(Date.now() - startedAt)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV2("p", {
        className: "kit-rehearsal__text",
        children: rehearsalTail(text2)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function RehearsalTrace({
  text: text2,
  seconds,
  open,
  onToggle
}) {
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "kit-trace",
    children: [
      /* @__PURE__ */ jsxDEV2("button", {
        type: "button",
        className: "kit-trace__line",
        onClick: onToggle,
        children: `· ${open ? "hide the rehearsal" : traceSummary(seconds, [...text2].length)}`
      }, undefined, false, undefined, this),
      open && /* @__PURE__ */ jsxDEV2("p", {
        className: "kit-trace__full",
        children: text2
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function WatchNote({ kinds }) {
  const what = kinds.length > 0 ? kinds.join(", ") : "the studio folder";
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "kit-watch",
    children: [
      /* @__PURE__ */ jsxDEV2("div", {
        className: "kit-watch__head",
        children: "NOTICED"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2("p", {
        className: "kit-watch__text",
        children: `${what} changed on disk, outside this window.`
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function Searchlight({ on }) {
  if (!on)
    return null;
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "kit-sweep",
    "aria-hidden": "true",
    children: /* @__PURE__ */ jsxDEV2("span", {
      className: "kit-sweep__rule",
      children: "━".repeat(240)
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
}
function KeyHints({ hints }) {
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "kit-hints",
    children: hints.map((hint) => /* @__PURE__ */ jsxDEV2("span", {
      className: "kit-hints__pair",
      children: [
        /* @__PURE__ */ jsxDEV2("span", {
          className: "kit-hints__key",
          children: hint.key
        }, undefined, false, undefined, this),
        hint.label !== undefined && /* @__PURE__ */ jsxDEV2("span", {
          className: "kit-hints__label",
          children: hint.label
        }, undefined, false, undefined, this)
      ]
    }, hint.key, true, undefined, this))
  }, undefined, false, undefined, this);
}

// src/ui/agent/kit-bands.tsx
import { useCallback as useCallback3, useEffect as useEffect5, useRef as useRef4, useState as useState5 } from "react";

// src/kit/render/say-fold.ts
var LONG_SAY_CHARS = 1200;
var isLongSay = (text2) => text2.length > LONG_SAY_CHARS;
function saysOpen(lines, index, line) {
  if (line.open !== undefined)
    return line.open;
  return !lines.some((later, at) => at > index && later.role === "say");
}

// src/kit/_shared/graphemes.ts
var segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
var splitGraphemes = (text2) => Array.from(segmenter.segment(text2), (part) => part.segment);
var truncateGraphemes = (text2, cap) => {
  const parts = splitGraphemes(text2);
  return parts.length > cap ? `${parts.slice(0, cap).join("").trimEnd()}…` : text2;
};

// src/ui/agent/kit-bands-core.ts
var ERROR_ROW_CHARS = 600;
function boundedError(text2) {
  return truncateGraphemes(text2, ERROR_ROW_CHARS);
}
function isFoldable(text2, streaming) {
  return !streaming && isLongSay(text2);
}
function sayIsOpen(lines, index) {
  const projected = lines.map((line) => ({
    role: line.role === "assistant" ? "say" : line.role,
    open: line.open
  }));
  const here = projected[index];
  if (!here)
    return true;
  return saysOpen(projected, index, here);
}
function foldSummary(text2) {
  return `said · ${String(text2.length)} chars · click reopens`;
}

// src/ui/agent/kit-bands.tsx
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
function CopyCorner({ onCopy }) {
  return /* @__PURE__ */ jsxDEV3("button", {
    type: "button",
    className: "kit-band__copy",
    onClick: (event) => {
      event.stopPropagation();
      onCopy();
    },
    children: "copy"
  }, undefined, false, undefined, this);
}
function CopyableBand({
  className,
  text: text2,
  onNotice,
  onClick,
  children
}) {
  const copy = useCallback3(() => {
    if (text2 === undefined)
      return;
    const written = navigator.clipboard?.writeText(text2);
    if (!written) {
      onNotice?.("could not reach the clipboard");
      return;
    }
    written.then(() => {
      onNotice?.("copied");
    }).catch(() => {
      onNotice?.("could not reach the clipboard");
    });
  }, [text2, onNotice]);
  return /* @__PURE__ */ jsxDEV3("div", {
    className: `${className} kit-band`,
    ...onClick ? { onClick } : {},
    children: [
      children,
      text2 !== undefined && /* @__PURE__ */ jsxDEV3(CopyCorner, {
        onCopy: copy
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function FoldedSay({ text: text2, onToggle }) {
  return /* @__PURE__ */ jsxDEV3("button", {
    type: "button",
    className: "kit-fold",
    onClick: onToggle,
    children: [
      /* @__PURE__ */ jsxDEV3("span", {
        className: "kit-fold__dot",
        children: "· "
      }, undefined, false, undefined, this),
      foldSummary(text2)
    ]
  }, undefined, true, undefined, this);
}
function ErrorRow({
  text: text2,
  onNotice
}) {
  return /* @__PURE__ */ jsxDEV3(CopyableBand, {
    className: "kit-error",
    text: text2,
    ...onNotice ? { onNotice } : {},
    children: /* @__PURE__ */ jsxDEV3("p", {
      className: "kit-error__text",
      children: [
        /* @__PURE__ */ jsxDEV3("span", {
          className: "kit-error__bang",
          children: "! "
        }, undefined, false, undefined, this),
        boundedError(text2)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
function StatusToast({ text: text2 }) {
  if (!text2)
    return null;
  return /* @__PURE__ */ jsxDEV3("div", {
    className: "kit-toast",
    role: "status",
    children: [
      /* @__PURE__ */ jsxDEV3("span", {
        className: "kit-toast__dot",
        children: "· "
      }, undefined, false, undefined, this),
      text2
    ]
  }, undefined, true, undefined, this);
}
function useNotice(holdMs = 2200) {
  const [notice, setNotice] = useState5(null);
  const timer = useRef4(null);
  const say = useCallback3((message) => {
    if (timer.current !== null)
      clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNotice(null);
    }, holdMs);
    setNotice(message);
  }, [holdMs]);
  useEffect5(() => () => {
    if (timer.current !== null)
      clearTimeout(timer.current);
  }, []);
  return { notice, say };
}

// src/kit/render/primitives/meters/context-meter-core.ts
var WARN_AT = 0.9;
var CRIT_AT = 1;
var nonNeg = (n) => Number.isFinite(n) && n > 0 ? n : 0;
var contextMeter = (consumed, max, width) => {
  const used = nonNeg(consumed);
  if (max === undefined || !Number.isFinite(max) || max <= 0) {
    return { known: false, consumed: used };
  }
  const ratio = used / max;
  const pct = Math.min(1, Math.max(0, ratio));
  const zone = ratio >= CRIT_AT ? "crit" : ratio >= WARN_AT ? "warn" : "calm";
  const cells = width >= 1 ? Math.floor(width) : 0;
  const filled = Math.min(cells, Math.max(0, Math.round(pct * cells)));
  const empty = cells - filled;
  return { known: true, consumed: used, max, pct, zone, filled, empty };
};

// src/kit/render/primitives/meters/format.ts
var short = (value, suffix) => {
  const rounded = Math.round(value * 10) / 10;
  const text2 = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text2}${suffix}`;
};
var compactTokens = (n) => {
  if (!Number.isFinite(n) || n <= 0)
    return "0";
  if (n >= 1e6)
    return short(n / 1e6, "M");
  if (n >= 1000)
    return short(n / 1000, "k");
  return String(Math.round(n));
};

// src/kit/render/primitives/meters/token-tally-core.ts
var tokenTally = (turn, session) => {
  const base = { turn: compactTokens(turn.total), session: compactTokens(session.total) };
  if (turn.total <= 0)
    return base;
  return { ...base, detail: `up ${compactTokens(turn.input)} down ${compactTokens(turn.output)}` };
};

// src/ui/agent/kit-meters.tsx
import { jsxDEV as jsxDEV4 } from "react/jsx-dev-runtime";
function ContextMeter({ consumed, max }) {
  const meter = contextMeter(consumed, max, BAR_WIDTH);
  if (!meter.known) {
    return /* @__PURE__ */ jsxDEV4("span", {
      className: "kit-meter",
      children: [
        /* @__PURE__ */ jsxDEV4("span", {
          className: "kit-meter__label",
          children: "ctx"
        }, undefined, false, undefined, this),
        ` ${compactTokens(meter.consumed)}`
      ]
    }, undefined, true, undefined, this);
  }
  const dim = meter.consumed === 0;
  const pct = Math.round(meter.pct * 100);
  return /* @__PURE__ */ jsxDEV4("span", {
    className: "kit-meter",
    children: [
      /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__label",
        children: "ctx"
      }, undefined, false, undefined, this),
      " ",
      /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__rule",
        children: "|"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("span", {
        style: { color: dim ? "var(--kit-mut)" : ZONE_INK[meter.zone] },
        children: "#".repeat(meter.filled)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__rule",
        children: ".".repeat(meter.empty)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__rule",
        children: "|"
      }, undefined, false, undefined, this),
      " ",
      /* @__PURE__ */ jsxDEV4("span", {
        className: dim ? "kit-meter__label" : "kit-meter__pct",
        children: `${String(pct)}%`
      }, undefined, false, undefined, this),
      " ",
      `${compactTokens(meter.consumed)} / ${compactTokens(meter.max)}`,
      meter.zone === "crit" && /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__crit",
        children: "  compact due"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function TokenTally({ tokens }) {
  const tally = tokenTally(tokens.turn, tokens.session);
  const dim = tokens.turn.total <= 0 && tokens.session.total <= 0;
  return /* @__PURE__ */ jsxDEV4("span", {
    className: dim ? "kit-tally kit-tally--dim" : "kit-tally",
    children: [
      /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__label",
        children: "turn"
      }, undefined, false, undefined, this),
      ` ${tally.turn}`,
      tally.detail !== undefined && /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__label",
        children: ` (${tally.detail})`
      }, undefined, false, undefined, this),
      "   ",
      /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meter__label",
        children: "session"
      }, undefined, false, undefined, this),
      ` ${tally.session}`
    ]
  }, undefined, true, undefined, this);
}
function MeterBar({
  tokens,
  maxContext
}) {
  return /* @__PURE__ */ jsxDEV4("div", {
    className: "kit-meterbar",
    children: [
      /* @__PURE__ */ jsxDEV4(ContextMeter, {
        consumed: contextConsumed(tokens),
        max: maxContext
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("span", {
        className: "kit-meterbar__gap"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4(TokenTally, {
        tokens
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/agent/kit-choice.tsx
import { useState as useState6 } from "react";

// src/kit/render/ask/ask-core.ts
var CHAT_INSTEAD = "Let's talk about this rather than pick one.";
function askRows(options) {
  const rows = options.map((option) => ({
    kind: "option",
    value: option.value,
    ...option.note === undefined ? {} : { note: option.note }
  }));
  rows.push({ kind: "rule" });
  rows.push({ kind: "own" });
  rows.push({ kind: "rule" });
  rows.push({ kind: "chat" });
  return rows;
}
function numberedRows(options) {
  let n = 0;
  return askRows(options).map((row) => {
    if (row.kind === "rule")
      return { row, number: null };
    n += 1;
    return { row, number: n };
  });
}
function pickableRows(options) {
  return askRows(options).filter((row) => row.kind !== "rule");
}
function armedAnswer(state) {
  const rows = pickableRows(state.options);
  const row = rows[state.cursor];
  if (!row)
    return null;
  if (row.kind === "option")
    return row.value;
  if (row.kind === "chat")
    return CHAT_INSTEAD;
  if (row.kind === "own") {
    const typed = state.own.trim();
    return typed.length > 0 ? typed : null;
  }
  return null;
}
function askMessage(state) {
  const answer = armedAnswer(state);
  if (answer === null)
    return null;
  const note = state.note.trim();
  return note.length > 0 ? `${answer}

Note: ${note}` : answer;
}

// src/ui/agent/kit-choice.tsx
import { jsxDEV as jsxDEV5 } from "react/jsx-dev-runtime";
function Answered({ question, answer }) {
  return /* @__PURE__ */ jsxDEV5("div", {
    className: "kit-ask kit-ask--done",
    children: [
      /* @__PURE__ */ jsxDEV5("p", {
        className: "kit-ask__q kit-ask__q--done",
        children: question
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV5("p", {
        className: "kit-ask__said",
        children: `✓ ${answer.replace(/\n+/g, " · ")}`
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function ChoiceList({
  choices,
  answered,
  busy,
  onSend
}) {
  const [state, setState] = useState6({
    options: choices.options,
    cursor: 0,
    own: "",
    note: ""
  });
  if (answered !== undefined)
    return /* @__PURE__ */ jsxDEV5(Answered, {
      question: choices.question,
      answer: answered
    }, undefined, false, undefined, this);
  const live = { ...state, options: choices.options };
  const armed = armedAnswer(live);
  const rows = numberedRows(choices.options);
  let pickIndex = -1;
  return /* @__PURE__ */ jsxDEV5("div", {
    className: "kit-ask",
    children: [
      /* @__PURE__ */ jsxDEV5("div", {
        className: "kit-ask__head",
        children: [
          /* @__PURE__ */ jsxDEV5("span", {
            children: "PICK ONE"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5("span", {
            children: `${String(choices.options.length)} options`
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV5("p", {
        className: "kit-ask__q",
        children: choices.question
      }, undefined, false, undefined, this),
      rows.map((entry, at) => {
        if (entry.row.kind === "rule")
          return /* @__PURE__ */ jsxDEV5("div", {
            className: "kit-ask__rule"
          }, `r${String(at)}`, false, undefined, this);
        pickIndex += 1;
        const mine = pickIndex;
        const on = live.cursor === mine;
        const kind = entry.row.kind;
        const label = kind === "option" ? entry.row.value : kind === "own" ? "Write your own answer" : "Chat about this instead";
        return /* @__PURE__ */ jsxDEV5("div", {
          className: on ? "kit-ask__opt kit-ask__opt--on" : "kit-ask__opt",
          children: [
            /* @__PURE__ */ jsxDEV5("button", {
              type: "button",
              className: "kit-ask__pick",
              disabled: busy,
              onClick: () => {
                setState((prior) => ({ ...prior, cursor: mine }));
              },
              children: [
                /* @__PURE__ */ jsxDEV5("span", {
                  className: "kit-ask__caret",
                  children: on ? "❯" : " "
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV5("span", {
                  className: "kit-ask__num",
                  children: `${String(entry.number ?? 0)}. `
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV5("span", {
                  className: kind === "option" ? "kit-ask__val" : "kit-ask__esc",
                  children: label
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            kind === "option" && entry.row.note !== undefined && /* @__PURE__ */ jsxDEV5("p", {
              className: "kit-ask__note",
              children: entry.row.note
            }, undefined, false, undefined, this),
            kind === "own" && on && /* @__PURE__ */ jsxDEV5("input", {
              className: "kit-ask__own",
              type: "text",
              value: live.own,
              placeholder: "your answer",
              disabled: busy,
              onChange: (e) => {
                setState((prior) => ({ ...prior, own: e.target.value }));
              }
            }, undefined, false, undefined, this)
          ]
        }, `o${String(at)}`, true, undefined, this);
      }),
      /* @__PURE__ */ jsxDEV5("input", {
        className: "kit-ask__noteField",
        type: "text",
        value: live.note,
        placeholder: "note - a caveat, a condition, a thought",
        disabled: busy,
        onChange: (e) => {
          setState((prior) => ({ ...prior, note: e.target.value }));
        }
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV5("div", {
        className: armed === null ? "kit-ask__arm" : "kit-ask__arm kit-ask__arm--ready",
        children: [
          /* @__PURE__ */ jsxDEV5("span", {
            className: "kit-ask__armText",
            children: armed === null ? "pick one, then send it" : `sends ${armed}${live.note.trim() ? " · with your note" : ""}`
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV5("button", {
            type: "button",
            className: "kit-ask__send",
            disabled: busy || armed === null,
            onClick: () => {
              const message = askMessage(live);
              if (message !== null)
                onSend(message);
            },
            children: "Send"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/agent/kit-command-bands.tsx
import { jsxDEV as jsxDEV6 } from "react/jsx-dev-runtime";
var STATUS_INK = {
  ok: "var(--kit-alive)",
  warn: "var(--kit-gold)",
  fail: "var(--kit-red)"
};
function Rows({
  title,
  rows,
  hint,
  onSend,
  onRewind
}) {
  return /* @__PURE__ */ jsxDEV6("div", {
    className: "kit-list",
    children: [
      /* @__PURE__ */ jsxDEV6("div", {
        className: "kit-list__head",
        children: title
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "kit-list__rows",
        children: rows.map((row, at) => {
          const label = /* @__PURE__ */ jsxDEV6("span", {
            className: "kit-list__key",
            children: row.label
          }, undefined, false, undefined, this);
          const note = row.note === undefined ? null : /* @__PURE__ */ jsxDEV6("span", {
            className: "kit-list__note",
            children: row.note
          }, undefined, false, undefined, this);
          const act = row.send !== undefined ? () => {
            onSend(row.send);
          } : row.keep !== undefined ? () => {
            onRewind(row.keep);
          } : null;
          const key = `${row.label}${String(at)}`;
          return act === null ? /* @__PURE__ */ jsxDEV6("div", {
            className: "kit-list__row",
            children: [
              label,
              note
            ]
          }, key, true, undefined, this) : /* @__PURE__ */ jsxDEV6("button", {
            type: "button",
            className: "kit-list__row kit-list__row--act",
            onClick: act,
            children: [
              label,
              note
            ]
          }, key, true, undefined, this);
        })
      }, undefined, false, undefined, this),
      hint !== undefined && /* @__PURE__ */ jsxDEV6("p", {
        className: "kit-list__hint",
        children: hint
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function Doctor({ rows }) {
  return /* @__PURE__ */ jsxDEV6("div", {
    className: "kit-doctor",
    children: [
      /* @__PURE__ */ jsxDEV6("div", {
        className: "kit-list__head",
        children: "DOCTOR"
      }, undefined, false, undefined, this),
      rows.length === 0 && /* @__PURE__ */ jsxDEV6("p", {
        className: "kit-list__hint",
        children: "No checks are wired in this build."
      }, undefined, false, undefined, this),
      rows.map((row, at) => /* @__PURE__ */ jsxDEV6("div", {
        className: "kit-doctor__row",
        style: { borderLeftColor: STATUS_INK[row.status] },
        children: [
          /* @__PURE__ */ jsxDEV6("span", {
            className: "kit-doctor__mark",
            style: { color: STATUS_INK[row.status] },
            children: row.status
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV6("span", {
            className: "kit-list__key",
            children: row.label
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV6("span", {
            className: "kit-list__note",
            children: row.detail
          }, undefined, false, undefined, this)
        ]
      }, `${row.label}${String(at)}`, true, undefined, this))
    ]
  }, undefined, true, undefined, this);
}
function Pictures({ title, images }) {
  return /* @__PURE__ */ jsxDEV6("div", {
    className: "kit-shelf",
    children: [
      /* @__PURE__ */ jsxDEV6("div", {
        className: "kit-list__head",
        children: title
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "kit-shelf__strip",
        children: images.images.map((image, at) => /* @__PURE__ */ jsxDEV6("figure", {
          className: "kit-shelf__frame",
          children: [
            /* @__PURE__ */ jsxDEV6("img", {
              src: image.src,
              alt: image.caption ?? "picture"
            }, undefined, false, undefined, this),
            image.caption !== undefined && /* @__PURE__ */ jsxDEV6("figcaption", {
              children: image.caption
            }, undefined, false, undefined, this)
          ]
        }, `${image.src.slice(-24)}${String(at)}`, true, undefined, this))
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function KitCommandBand({
  title,
  widget,
  onSend,
  onRewind
}) {
  if (widget.kind === "doctor")
    return /* @__PURE__ */ jsxDEV6(Doctor, {
      rows: widget.rows
    }, undefined, false, undefined, this);
  if (widget.kind === "images")
    return /* @__PURE__ */ jsxDEV6(Pictures, {
      title,
      images: widget
    }, undefined, false, undefined, this);
  return /* @__PURE__ */ jsxDEV6(Rows, {
    title,
    rows: widget.rows,
    ...widget.hint === undefined ? {} : { hint: widget.hint },
    onSend,
    onRewind
  }, undefined, false, undefined, this);
}

// src/ui/agent/kit-markdown.tsx
import { lazy, Suspense, useState as useState7 } from "react";

// src/kit/render/diff-classify.ts
var EXPLICIT_DIFF = /^(?:diff|patch|udiff)$/i;
var kindOf = (line) => {
  if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index "))
    return "meta";
  if (line.startsWith("+++") || line.startsWith("---"))
    return "meta";
  if (line.startsWith("+"))
    return "add";
  if (line.startsWith("-"))
    return "remove";
  return "context";
};
var classifyDiff = (lines, language) => {
  const explicit = EXPLICIT_DIFF.test(language?.trim() ?? "");
  const hasHunk = lines.some((line) => line.startsWith("@@"));
  const hasAdd = lines.some((line) => line.startsWith("+") && !line.startsWith("+++"));
  const hasRemove = lines.some((line) => line.startsWith("-") && !line.startsWith("---"));
  if (!explicit && !(hasHunk && hasAdd && hasRemove))
    return null;
  const classified = lines.map((text2) => ({ kind: kindOf(text2), text: text2 }));
  return {
    additions: classified.filter((line) => line.kind === "add").length,
    removals: classified.filter((line) => line.kind === "remove").length,
    lines: classified
  };
};

// src/kit/render/markdown.ts
var INLINE = /(`[^`\n]+`)|(\*\*[^\n]+?\*\*|__[^\n]+?__)|(\*[^\n*]+?\*)|(\[[^\]\n]+\]\([^)\n]+\))/g;
var LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;
var parseInline = (line) => {
  const out = [];
  let last = 0;
  INLINE.lastIndex = 0;
  for (let m = INLINE.exec(line);m; m = INLINE.exec(line)) {
    if (m.index > last)
      out.push({ t: "text", s: line.slice(last, m.index) });
    if (m[1])
      out.push({ t: "code", s: m[1].slice(1, -1) });
    else if (m[2])
      out.push({ t: "bold", s: m[2].slice(2, -2) });
    else if (m[3])
      out.push({ t: "italic", s: m[3].slice(1, -1) });
    else if (m[4]) {
      const link = LINK.exec(m[4]);
      if (link)
        out.push({ t: "link", s: link[1], href: link[2] });
      else
        out.push({ t: "text", s: m[4] });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length)
    out.push({ t: "text", s: line.slice(last) });
  return out.length > 0 ? out : [{ t: "text", s: line }];
};
var HR = /^\s*(---+|\*\*\*+|___+)\s*$/;
var FENCE = /^\s*```/;
var HEADING = /^(#{1,6})\s+(.+)$/;
var QUOTE = /^\s*>\s?(.*)$/;
var BULLET = /^(\s*)[-*+]\s+(.+)$/;
var ORDERED = /^(\s*)(\d+)[.)]\s+(.+)$/;
var TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
var hasPipe = (l) => l.includes("|");
var cellsOf = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
var isSpecial = (l) => !l.trim() || FENCE.test(l) || HEADING.test(l) || QUOTE.test(l) || BULLET.test(l) || ORDERED.test(l) || HR.test(l) || TABLE_RULE.test(l);
var parseMarkdown = (src) => {
  const lines = src.replace(/\r\n/g, `
`).split(`
`);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (FENCE.test(line)) {
      const lang = line.replace(/^\s*```/, "").trim() || undefined;
      i += 1;
      const code = [];
      while (i < lines.length && !FENCE.test(lines[i]))
        code.push(lines[i++]);
      const closed = i < lines.length;
      i += 1;
      blocks.push({ t: "code", lines: code, lang, closed });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (HR.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: "heading", level: h[1].length, spans: parseInline(h[2]) });
      i += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      const parts = [];
      for (let q = QUOTE.exec(lines[i]);q; q = i < lines.length ? QUOTE.exec(lines[i]) : null) {
        parts.push(q[1]);
        i += 1;
      }
      blocks.push({ t: "quote", spans: parseInline(parts.join(" ")) });
      continue;
    }
    const ruleAhead = i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]);
    if (hasPipe(line) && ruleAhead) {
      const head = cellsOf(line);
      i += 2;
      const rows = [];
      while (i < lines.length && hasPipe(lines[i]) && lines[i].trim()) {
        const cells = cellsOf(lines[i]);
        rows.push(Array.from({ length: head.length }, (_, c) => parseInline(cells[c] ?? "")));
        i += 1;
      }
      blocks.push({ t: "table", head: head.map((c) => parseInline(c)), rows });
      continue;
    }
    const b = BULLET.exec(line);
    if (b) {
      blocks.push({ t: "bullet", depth: Math.floor(b[1].length / 2), spans: parseInline(b[2]) });
      i += 1;
      continue;
    }
    const o = ORDERED.exec(line);
    if (o) {
      blocks.push({ t: "ordered", depth: Math.floor(o[1].length / 2), num: parseInt(o[2], 10), spans: parseInline(o[3]) });
      i += 1;
      continue;
    }
    const para = [];
    while (i < lines.length && !isSpecial(lines[i]))
      para.push(lines[i++]);
    blocks.push({ t: "para", spans: parseInline(para.join(" ")) });
  }
  return blocks;
};

// src/ui/_shared/render-policy.ts
var SAFE_SCHEME = /^(?:https?:|mailto:)/i;
var isSafeHref = (href) => {
  const h = href.trim();
  if (h === "")
    return false;
  if (h.startsWith("#") || h.startsWith("/"))
    return true;
  return SAFE_SCHEME.test(h);
};
var ALLOWED_INLINE_STYLE_PROPS = new Set([
  "text-align",
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "text-decoration"
]);

// src/ui/agent/kit-markdown-core.ts
var DIFF_LINE_CAP = 80;
var OUTWARD = /^(?:https?|mailto):/i;
var BLANKS = /[\u0000-\u0020]/g;
function safeLinkHref(href) {
  const stripped = href.replace(BLANKS, "");
  if (stripped === "")
    return null;
  if (!OUTWARD.test(stripped))
    return null;
  return isSafeHref(stripped) ? stripped : null;
}
function diffInk(kind) {
  if (kind === "add")
    return "var(--kit-alive)";
  if (kind === "remove")
    return "var(--kit-red)";
  if (kind === "meta")
    return "var(--kit-violet)";
  return "var(--kit-soft)";
}

// src/ui/agent/kit-markdown.tsx
import { jsxDEV as jsxDEV8, Fragment } from "react/jsx-dev-runtime";
var SealedHtmlPreview2 = lazy(async () => {
  const mod = await Promise.resolve().then(() => (init_sealed_html_preview(), exports_sealed_html_preview));
  return { default: mod.SealedHtmlPreview };
});
function Span({ span }) {
  if (span.t === "bold")
    return /* @__PURE__ */ jsxDEV8("strong", {
      className: "kit-md__b",
      children: span.s
    }, undefined, false, undefined, this);
  if (span.t === "italic")
    return /* @__PURE__ */ jsxDEV8("em", {
      className: "kit-md__i",
      children: span.s
    }, undefined, false, undefined, this);
  if (span.t === "code")
    return /* @__PURE__ */ jsxDEV8("code", {
      className: "kit-md__code",
      children: span.s
    }, undefined, false, undefined, this);
  if (span.t === "link") {
    const href = safeLinkHref(span.href);
    if (href === null)
      return /* @__PURE__ */ jsxDEV8("span", {
        className: "kit-md__deadlink",
        title: span.href,
        children: span.s
      }, undefined, false, undefined, this);
    return /* @__PURE__ */ jsxDEV8("a", {
      className: "kit-md__link",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
      children: span.s
    }, undefined, false, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV8("span", {
    children: span.s
  }, undefined, false, undefined, this);
}
function Spans({ spans }) {
  return /* @__PURE__ */ jsxDEV8(Fragment, {
    children: spans.map((span, i) => /* @__PURE__ */ jsxDEV8(Span, {
      span
    }, `s${String(i)}`, false, undefined, this))
  }, undefined, false, undefined, this);
}
var DRAWABLE = new Set(["html"]);
function PlainSlab({ block }) {
  const [preview, setPreview] = useState7(false);
  const source = block.lines.join(`
`);
  const canDraw = block.lang !== undefined && DRAWABLE.has(block.lang.toLowerCase()) && block.closed === true && source.trim().length > 0;
  return /* @__PURE__ */ jsxDEV8("div", {
    className: "kit-md__slabwrap",
    children: [
      canDraw && /* @__PURE__ */ jsxDEV8("button", {
        type: "button",
        className: "kit-md__preview",
        "aria-pressed": preview,
        onClick: () => setPreview(!preview),
        children: preview ? "Show source" : "Preview"
      }, undefined, false, undefined, this),
      canDraw && /* @__PURE__ */ jsxDEV8("button", {
        type: "button",
        className: "kit-md__preview",
        onClick: () => handOffHtml(source),
        children: "Open as tab"
      }, undefined, false, undefined, this),
      canDraw && preview ? /* @__PURE__ */ jsxDEV8(Suspense, {
        fallback: /* @__PURE__ */ jsxDEV8("p", {
          className: "kit-md__p",
          children: "Loading preview…"
        }, undefined, false, undefined, this),
        children: /* @__PURE__ */ jsxDEV8(SealedHtmlPreview2, {
          html: source,
          title: "Preview of HTML the agent wrote"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV8("pre", {
        className: "kit-md__slab",
        children: [
          block.lang !== undefined && /* @__PURE__ */ jsxDEV8("span", {
            className: "kit-md__lang",
            children: block.lang
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV8("code", {
            children: source
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function CodeBlock({ block }) {
  const diff = classifyDiff(block.lines, block.lang);
  if (!diff) {
    return /* @__PURE__ */ jsxDEV8(PlainSlab, {
      block
    }, undefined, false, undefined, this);
  }
  const shown = diff.lines.slice(0, DIFF_LINE_CAP);
  return /* @__PURE__ */ jsxDEV8("pre", {
    className: "kit-md__slab kit-md__slab--diff",
    children: [
      /* @__PURE__ */ jsxDEV8("span", {
        className: "kit-md__difflabel",
        children: [
          "DIFF ",
          /* @__PURE__ */ jsxDEV8("span", {
            style: { color: "var(--kit-alive)" },
            children: `+${String(diff.additions)}`
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV8("span", {
            style: { color: "var(--kit-red)" },
            children: ` -${String(diff.removals)}`
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      shown.map((line, i) => /* @__PURE__ */ jsxDEV8("span", {
        className: "kit-md__diffline",
        style: { color: diffInk(line.kind) },
        children: line.text
      }, `d${String(i)}`, false, undefined, this)),
      diff.lines.length > DIFF_LINE_CAP && /* @__PURE__ */ jsxDEV8("span", {
        className: "kit-md__more",
        children: `${String(diff.lines.length - DIFF_LINE_CAP)} more lines`
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function BlockView({ block }) {
  if (block.t === "heading")
    return /* @__PURE__ */ jsxDEV8("p", {
      className: "kit-md__head",
      children: /* @__PURE__ */ jsxDEV8(Spans, {
        spans: block.spans
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  if (block.t === "para")
    return /* @__PURE__ */ jsxDEV8("p", {
      className: "kit-md__p",
      children: /* @__PURE__ */ jsxDEV8(Spans, {
        spans: block.spans
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  if (block.t === "bullet") {
    return /* @__PURE__ */ jsxDEV8("p", {
      className: "kit-md__li",
      style: { paddingLeft: `${String(block.depth + 1)}rem` },
      children: [
        /* @__PURE__ */ jsxDEV8("span", {
          className: "kit-md__mark",
          children: "- "
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV8(Spans, {
          spans: block.spans
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  if (block.t === "ordered") {
    return /* @__PURE__ */ jsxDEV8("p", {
      className: "kit-md__li",
      style: { paddingLeft: `${String(block.depth + 1)}rem` },
      children: [
        /* @__PURE__ */ jsxDEV8("span", {
          className: "kit-md__mark",
          children: `${String(block.num)}. `
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV8(Spans, {
          spans: block.spans
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  if (block.t === "quote")
    return /* @__PURE__ */ jsxDEV8("p", {
      className: "kit-md__quote",
      children: /* @__PURE__ */ jsxDEV8(Spans, {
        spans: block.spans
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  if (block.t === "code")
    return /* @__PURE__ */ jsxDEV8(CodeBlock, {
      block
    }, undefined, false, undefined, this);
  if (block.t === "table")
    return /* @__PURE__ */ jsxDEV8(TableBlock, {
      block
    }, undefined, false, undefined, this);
  if (block.t === "hr")
    return /* @__PURE__ */ jsxDEV8("hr", {
      className: "kit-md__rule"
    }, undefined, false, undefined, this);
  return null;
}
function TableBlock({ block }) {
  const [open, setOpen] = useState7(false);
  const grid = /* @__PURE__ */ jsxDEV8("table", {
    className: "kit-md__table",
    children: [
      /* @__PURE__ */ jsxDEV8("thead", {
        children: /* @__PURE__ */ jsxDEV8("tr", {
          children: block.head.map((cell, c) => /* @__PURE__ */ jsxDEV8("th", {
            children: /* @__PURE__ */ jsxDEV8(Spans, {
              spans: cell
            }, undefined, false, undefined, this)
          }, c, false, undefined, this))
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV8("tbody", {
        children: block.rows.map((row, r) => /* @__PURE__ */ jsxDEV8("tr", {
          children: row.map((cell, c) => /* @__PURE__ */ jsxDEV8("td", {
            children: /* @__PURE__ */ jsxDEV8(Spans, {
              spans: cell
            }, undefined, false, undefined, this)
          }, c, false, undefined, this))
        }, r, false, undefined, this))
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
  return /* @__PURE__ */ jsxDEV8("div", {
    className: "kit-md__tablewrap",
    children: [
      /* @__PURE__ */ jsxDEV8("div", {
        className: "kit-md__tablescroll",
        children: grid
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV8("button", {
        type: "button",
        className: "kit-md__tableout",
        title: "Open this table over the window",
        onClick: () => {
          setOpen(true);
        },
        children: "open"
      }, undefined, false, undefined, this),
      open && /* @__PURE__ */ jsxDEV8("div", {
        className: "kit-md__sheet",
        role: "dialog",
        "aria-label": "Table",
        onClick: () => {
          setOpen(false);
        },
        children: /* @__PURE__ */ jsxDEV8("div", {
          className: "kit-md__sheetbody",
          onClick: (e) => {
            e.stopPropagation();
          },
          children: [
            /* @__PURE__ */ jsxDEV8("button", {
              type: "button",
              className: "kit-md__sheetclose",
              onClick: () => {
                setOpen(false);
              },
              children: "close"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV8("div", {
              className: "kit-md__tablescroll",
              children: grid
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function KitMarkdown({ text: text3 }) {
  const blocks = parseMarkdown(text3);
  const out = blocks.map((block, i) => /* @__PURE__ */ jsxDEV8(BlockView, {
    block
  }, `b${String(i)}`, false, undefined, this));
  return /* @__PURE__ */ jsxDEV8("div", {
    className: "kit-md",
    children: out
  }, undefined, false, undefined, this);
}

// src/ui/agent/kit-transcript.tsx
import { jsxDEV as jsxDEV9, Fragment as Fragment2 } from "react/jsx-dev-runtime";
function Line({
  line,
  index,
  lines,
  busy,
  acts,
  onFold,
  onNotice,
  onAnswer
}) {
  if (line.role === "kit") {
    return /* @__PURE__ */ jsxDEV9("div", {
      className: "agent-room__line agent-room__line--kit",
      children: line.widget ? /* @__PURE__ */ jsxDEV9(KitCommandBand, {
        title: line.text,
        widget: line.widget,
        onSend: acts.onSend,
        onRewind: acts.onRewind
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV9(CopyableBand, {
        className: "agent-room__body",
        text: line.text,
        onNotice,
        children: /* @__PURE__ */ jsxDEV9(KitMarkdown, {
          text: line.text
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  }
  const foldable = line.role === "assistant" && isFoldable(line.text, false);
  const open = sayIsOpen(lines, index);
  if (foldable && !open) {
    return /* @__PURE__ */ jsxDEV9(FoldedSay, {
      text: line.text,
      onToggle: () => {
        onFold(index, true);
      }
    }, undefined, false, undefined, this);
  }
  const who = line.role === "user" ? "you" : line.role === "tool" ? "did" : "agent";
  return /* @__PURE__ */ jsxDEV9("div", {
    className: `agent-room__line agent-room__line--${line.role}`,
    ...line.tool ? { style: { borderLeftColor: verbOf(line.tool) } } : {},
    children: [
      /* @__PURE__ */ jsxDEV9(CopyableBand, {
        className: "agent-room__body",
        text: line.text,
        onNotice,
        ...foldable ? {
          onClick: () => {
            if ((window.getSelection()?.toString() ?? "") !== "")
              return;
            onFold(index, false);
          }
        } : {},
        children: [
          /* @__PURE__ */ jsxDEV9("span", {
            className: "agent-room__who",
            children: who
          }, undefined, false, undefined, this),
          line.role === "assistant" ? /* @__PURE__ */ jsxDEV9(KitMarkdown, {
            text: line.text
          }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV9("p", {
            className: "agent-room__said",
            children: line.text
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      line.choices !== undefined && /* @__PURE__ */ jsxDEV9(ChoiceList, {
        choices: line.choices,
        ...line.answered === undefined ? {} : { answered: line.answered },
        busy,
        onSend: (message) => {
          onAnswer(index, message);
        }
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function Transcript({
  lines,
  streaming,
  busy,
  problem,
  acts,
  onFold,
  onNotice,
  onAnswer
}) {
  return /* @__PURE__ */ jsxDEV9(Fragment2, {
    children: [
      lines.map((line, i) => /* @__PURE__ */ jsxDEV9(Line, {
        line,
        index: i,
        lines,
        busy,
        acts,
        onFold,
        onNotice,
        onAnswer
      }, `${line.role}${String(i)}`, false, undefined, this)),
      streaming && /* @__PURE__ */ jsxDEV9("div", {
        className: "agent-room__line agent-room__line--assistant",
        children: /* @__PURE__ */ jsxDEV9("div", {
          className: "agent-room__body",
          children: [
            /* @__PURE__ */ jsxDEV9("span", {
              className: "agent-room__who",
              children: "agent"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV9(KitMarkdown, {
              text: streaming
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      problem !== null && /* @__PURE__ */ jsxDEV9(ErrorRow, {
        text: problem,
        onNotice
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/agent/kit-transcript-style.ts
var KIT_MD_STYLE = `
.kit-md{display:flex;flex-direction:column;gap:.4rem}
.kit-md p{margin:0}
.kit-md__p{font-size:.83rem;line-height:1.55;color:var(--kit-soft);overflow-wrap:anywhere}
/* Every heading level renders the same: bright and heavy. \`######\` is not a volume control. */
.kit-md__head{font-family:var(--font-big);font-weight:900;font-size:.9rem;line-height:1.3;
  color:var(--kit-bright);margin-top:.15rem}
.kit-md__b{color:var(--kit-text);font-weight:700}
.kit-md__i{color:var(--kit-soft);font-style:italic}
/* Inline code: Kit's gold on the sunken field fill, the same slab colour a fence gets. */
.kit-md__code{background:var(--kit-sunken);color:var(--kit-gold);font-family:var(--font-mono);
  font-size:.76rem;padding:0 .2rem;overflow-wrap:anywhere}
.kit-md__link{color:var(--kit-teal);text-decoration:underline;overflow-wrap:anywhere}
/* A refused link keeps its words and loses its click, so a reader can see a link was attempted. */
.kit-md__deadlink{color:var(--kit-quiet);text-decoration:line-through}

.kit-md__li{font-size:.83rem;line-height:1.5;color:var(--kit-soft);overflow-wrap:anywhere}
/* The marker is TEXT, so it floors at \`quiet\` rather than sitting in the border grey Kit uses. */
.kit-md__mark{color:var(--kit-quiet);font-family:var(--font-mono)}
/* The quote bar is a real border in \`mut\`, which is what \`mut\` is for. */
.kit-md__quote{border-left:2px solid var(--kit-mut);padding-left:.5rem;font-style:italic;
  font-size:.83rem;line-height:1.5;color:var(--kit-soft)}
.kit-md__rule{border:0;border-top:1px solid var(--kit-div);margin:.2rem 0}
/* A TABLE, DRAWN AS ONE. Models reach for a pipe table whenever they compare two things, and it
   used to arrive as a wall of pipes and dashes to be read like a puzzle. */
.kit-md__tablewrap{position:relative;margin:.35rem 0}
.kit-md__tablescroll{overflow-x:auto;max-width:100%}
.kit-md__table{border-collapse:collapse;font-size:.75rem;min-width:100%}
.kit-md__table th,.kit-md__table td{border:1px solid var(--kit-line);padding:.2rem .45rem;
  text-align:left;vertical-align:top}
.kit-md__table th{color:var(--kit-text);font-weight:700;background:var(--kit-sunken);white-space:nowrap}
.kit-md__table td{color:var(--kit-soft)}
/* the pop-out key: in the corner of the table, not in the flow of the sentence around it */
.kit-md__tableout{position:absolute;top:0;right:0;background:var(--kit-panel);border:1px solid var(--kit-line);
  color:var(--kit-quiet);cursor:pointer;font-family:var(--kit-mono);font-size:.5rem;letter-spacing:.1em;
  text-transform:uppercase;padding:.1rem .3rem}
.kit-md__tableout:hover{color:var(--kit-text);border-color:var(--kit-mut)}
/* opened: the same table, at a size that fits a five-column comparison */
.kit-md__sheet{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;
  padding:2rem;background:rgb(0 0 0 / 62%)} /* hardcode-ok: a scrim is depth, not a themed colour */
.kit-md__sheetbody{position:relative;max-width:min(96vw,72rem);max-height:88vh;overflow:auto;
  background:var(--kit-panel);border:1px solid var(--kit-line);padding:1.4rem 1rem 1rem}
.kit-md__sheetclose{position:absolute;top:.3rem;right:.4rem;background:transparent;border:1px solid var(--kit-line);
  color:var(--kit-quiet);cursor:pointer;font-family:var(--kit-mono);font-size:.5rem;letter-spacing:.1em;
  text-transform:uppercase;padding:.15rem .35rem}

/* A code slab: the recessed field fill IS the slab, exactly as in the terminal. */
.kit-md__slab{display:flex;flex-direction:column;margin:0;background:var(--kit-sunken);
  border:1px solid var(--kit-line);padding:.4rem .5rem;font-family:var(--font-mono);
  font-size:.72rem;line-height:1.45;color:var(--kit-teal);white-space:pre;overflow-x:auto}
.kit-md__lang{color:var(--kit-quiet);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase}
.kit-md__difflabel{color:var(--kit-bright);font-weight:700;margin-bottom:.15rem}
.kit-md__diffline{white-space:pre}
.kit-md__more{color:var(--kit-quiet);margin-top:.15rem}
`;
var KIT_BAND_STYLE = `
/* Positioned so the corner can layer without pushing a single row down. */
.kit-band{position:relative}
.agent-room__body{position:relative;display:flex;flex-direction:column;gap:.1rem}
.agent-room__said{margin:0;font-size:.83rem;line-height:1.55;color:var(--kit-soft);
  white-space:pre-wrap;overflow-wrap:anywhere}
.agent-room__line--user .agent-room__said{color:var(--kit-text)}
.agent-room__line--tool .agent-room__said{font-family:var(--font-mono);font-size:.74rem}

/* HOVER-ONLY AND LAYERED. A control that took a row would move every message down the moment a
   mouse crossed it, and a transcript that reflows under the pointer is one you cannot read. */
.kit-band__copy{position:absolute;top:0;right:0;opacity:0;background:var(--kit-panel);
  border:1px solid var(--kit-line);color:var(--kit-quiet);font-family:var(--font-mono);
  font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;padding:.1rem .35rem;
  cursor:pointer}
.kit-band:hover .kit-band__copy,.kit-band__copy:focus-visible{opacity:1}
.kit-band__copy:hover{color:var(--kit-text);background:var(--kit-lift)}

/* The folded reply: one indented row, never a full-width block of its own. */
.kit-fold{display:block;width:100%;text-align:left;background:none;border:0;cursor:pointer;
  padding:.2rem .7rem .2rem 1.4rem;font-family:var(--font-mono);font-size:.7rem;
  color:var(--kit-quiet)}
.kit-fold:hover{color:var(--kit-soft)}
.kit-fold__dot{color:var(--kit-teal-deep)}

/* A failure: a red spine and a bang, so it never reads as something the agent said. */
.kit-error{margin:.2rem .7rem;background:var(--kit-recess);border-left:2px solid var(--kit-red);
  padding:.45rem .6rem}
.kit-error__text{margin:0;font-size:.78rem;line-height:1.5;color:var(--kit-soft);
  white-space:pre-wrap;overflow-wrap:anywhere}
.kit-error__bang{color:var(--kit-red);font-weight:700}

/* The toast: the outcome of a local gesture, not something anybody said. */
.kit-toast{padding:.15rem .7rem;font-family:var(--font-mono);font-size:.66rem;
  color:var(--kit-soft);flex:none}
.kit-toast__dot{color:var(--kit-teal)}
`;
var KIT_METER_STYLE = `
.kit-meterbar{display:flex;align-items:center;gap:.5rem;background:var(--kit-panel);
  border-bottom:1px solid var(--kit-seam);padding:.15rem .7rem;font-family:var(--font-mono);
  font-size:.64rem;color:var(--kit-soft);flex:none;overflow-x:auto;white-space:nowrap}
.kit-meterbar__gap{flex:1 1 auto}
.kit-meter,.kit-tally{white-space:pre}
/* The label and the unlit cells are the quietest legible text, never the border grey. */
.kit-meter__label{color:var(--kit-quiet)}
.kit-meter__rule{color:var(--kit-quiet)}
.kit-meter__pct{color:var(--kit-text)}
.kit-meter__crit{color:var(--kit-rose)}
.kit-tally--dim{color:var(--kit-quiet)}
`;
var KIT_ASK_STYLE = `
.kit-ask{display:flex;flex-direction:column;margin:.35rem 0 .1rem;
  border-left:2px solid var(--kit-teal);background:var(--kit-recess)}
.kit-ask__head{display:flex;justify-content:space-between;background:var(--kit-panel);
  padding:.2rem .5rem;font-family:var(--font-mono);font-size:.56rem;letter-spacing:.18em;
  color:var(--kit-quiet)}
.kit-ask__q{margin:0;padding:.35rem .5rem;font-size:.82rem;line-height:1.45;color:var(--kit-text)}
.kit-ask__rule{height:1px;background:var(--kit-div);margin:.15rem .5rem}

.kit-ask__opt{display:flex;flex-direction:column}
.kit-ask__opt--on{background:var(--kit-lift)}
.kit-ask__pick{display:flex;gap:.3rem;align-items:baseline;width:100%;text-align:left;
  background:none;border:0;cursor:pointer;padding:.2rem .5rem;font-family:var(--font-mono);
  font-size:.76rem;color:var(--kit-soft)}
.kit-ask__pick:disabled{cursor:not-allowed;color:var(--kit-quiet)}
.kit-ask__caret{color:var(--kit-teal);width:1ch;flex:none}
.kit-ask__num{color:var(--kit-quiet);flex:none}
.kit-ask__val{color:var(--kit-soft);overflow-wrap:anywhere}
.kit-ask__opt--on .kit-ask__val{color:var(--kit-text)}
/* The escapes read quieter than the answers: they are ways out, not things that answer. */
.kit-ask__esc{color:var(--kit-quiet);font-style:italic}
.kit-ask__note{margin:0;padding:0 .5rem .2rem 2.1rem;font-size:.72rem;line-height:1.4;
  color:var(--kit-quiet)}
.kit-ask__own,.kit-ask__noteField{margin:.15rem .5rem .25rem;background:var(--kit-sunken);
  border:1px solid var(--kit-line);color:var(--kit-text);font-family:var(--font-body);
  font-size:.76rem;padding:.2rem .4rem}
.kit-ask__own::placeholder,.kit-ask__noteField::placeholder{color:var(--kit-quiet)}
.kit-ask__own:focus,.kit-ask__noteField:focus{outline:none;border-color:var(--kit-teal)}

/* What the button will send, spelled out before it goes. */
.kit-ask__arm{display:flex;align-items:center;gap:.4rem;justify-content:space-between;
  padding:.25rem .5rem;background:var(--kit-recess)}
.kit-ask__arm--ready{background:var(--kit-panel)}
.kit-ask__armText{font-family:var(--font-mono);font-size:.66rem;color:var(--kit-quiet);
  overflow-wrap:anywhere}
.kit-ask__arm--ready .kit-ask__armText{color:var(--kit-soft)}
.kit-ask__send{flex:none;background:var(--kit-floor);border:1px solid var(--kit-teal-deep);
  color:var(--kit-teal);font-family:var(--font-mono);font-weight:700;font-size:.62rem;
  letter-spacing:.08em;text-transform:uppercase;padding:.22rem .6rem;cursor:pointer}
.kit-ask__send:hover:not(:disabled){background:var(--kit-lift);color:var(--kit-text)}
.kit-ask__send:disabled{color:var(--kit-quiet);border-color:var(--kit-line);cursor:not-allowed}

/* An answered panel collapses to what was said: live options in the scrollback invite answering
   the same question twice, and the model has already moved on. */
.kit-ask--done{border-left-color:var(--kit-teal-deep)}
.kit-ask__q--done{color:var(--kit-quiet);font-size:.76rem;padding-bottom:.1rem}
.kit-ask__said{margin:0;padding:0 .5rem .3rem;font-size:.78rem;color:var(--kit-soft)}
`;
var KIT_TRANSCRIPT_STYLE = KIT_MD_STYLE + KIT_BAND_STYLE + KIT_METER_STYLE + KIT_ASK_STYLE;

// src/ui/agent/kit-command-style.ts
var KIT_LIST_STYLE = `
.kit-list{display:flex;flex-direction:column;gap:.3rem;border-left:2px solid var(--kit-teal);
  background:var(--kit-recess);padding:.45rem .55rem}
.kit-list__head{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--kit-quiet)}
.kit-list__rows{display:flex;flex-direction:column}
/* A row is a grid so every label column lines up: a listing whose second column wanders is a
   listing nobody scans. */
.kit-list__row{display:grid;grid-template-columns:minmax(6rem,auto) 1fr;gap:.55rem;align-items:baseline;
  padding:.16rem .2rem;text-align:left;background:none;border:0;font:inherit;width:100%}
.kit-list__row--act{cursor:pointer}
.kit-list__row--act:hover,.kit-list__row--act:focus-visible{background:var(--kit-lift);outline:none}
/* Kit's CLI signature: a bright key, a muted label. */
.kit-list__key{font-family:var(--font-mono);font-size:.76rem;color:var(--kit-bright);
  overflow-wrap:anywhere}
.kit-list__note{font-size:.76rem;color:var(--kit-quiet);overflow-wrap:anywhere}
.kit-list__hint{margin:.15rem 0 0;font-size:.72rem;line-height:1.45;color:var(--kit-quiet)}
`;
var KIT_DOCTOR_STYLE = `
.kit-doctor{display:flex;flex-direction:column;gap:.2rem;background:var(--kit-recess);
  padding:.45rem .55rem}
/* The spine carries the status, so risk is legible before any of the words are - the same rule a
   tool row's verb colour follows. The colour itself is set inline, per row. */
.kit-doctor__row{display:grid;grid-template-columns:3rem minmax(5rem,auto) 1fr;gap:.5rem;
  align-items:baseline;border-left:2px solid var(--kit-mut);padding:.16rem .5rem}
.kit-doctor__mark{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.1em;
  text-transform:uppercase}
`;
var KIT_SHELF_STYLE = `
.kit-shelf{display:flex;flex-direction:column;gap:.3rem;border-left:2px solid var(--kit-violet);
  background:var(--kit-recess);padding:.45rem .55rem}
/* Scrolls sideways rather than reflowing: a shelf is a row of faces, and a shelf that wraps into a
   block stops reading as one. */
.kit-shelf__strip{display:flex;gap:.5rem;overflow-x:auto;padding-bottom:.2rem}
.kit-shelf__frame{margin:0;display:flex;flex-direction:column;gap:.2rem;flex:0 0 auto;
  max-width:min(15rem,60%)}
.kit-shelf__frame img{display:block;width:100%;height:auto;max-height:14rem;object-fit:contain;
  border:1px solid var(--kit-line);background:var(--kit-sunken)}
.kit-shelf__frame figcaption{font-size:.7rem;color:var(--kit-quiet);overflow-wrap:anywhere}
`;
var KIT_COMMAND_LINE_STYLE = `
.agent-room__line--kit{padding:.3rem .7rem;background:var(--kit-well)}
/* The popup anchors here rather than on the form, so composer key styling cannot reach its rows. */
.agent-room__compose{position:relative;flex:none}
`;
var KIT_SLASH_STYLE = `
.kit-slash{position:absolute;left:.7rem;right:.7rem;bottom:100%;z-index:3;
  display:flex;flex-direction:column;max-height:13rem;overflow-y:auto;
  background:var(--kit-panel);border:1px solid var(--kit-line)}
.kit-slash__head{font-family:var(--font-mono);font-size:.6rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--kit-quiet);padding:.25rem .45rem;
  border-bottom:1px solid var(--kit-seam)}
.kit-slash__row{display:grid;grid-template-columns:minmax(5.5rem,auto) 1fr;gap:.5rem;
  align-items:baseline;padding:.22rem .45rem;text-align:left;background:none;border:0;font:inherit;
  cursor:pointer;width:100%}
/* The highlight is the raised band, which is what Kit lifts an active list row with. */
.kit-slash__row--on{background:var(--kit-lift)}
.kit-slash__word{font-family:var(--font-mono);font-size:.76rem;color:var(--kit-bright)}
.kit-slash__say{font-size:.74rem;color:var(--kit-quiet);overflow-wrap:anywhere}
`;
var KIT_COMMAND_STYLE = KIT_LIST_STYLE + KIT_DOCTOR_STYLE + KIT_SHELF_STYLE + KIT_COMMAND_LINE_STYLE + KIT_SLASH_STYLE;

// src/ui/agent/use-kit-commands.ts
import { useCallback as useCallback4, useEffect as useEffect7, useMemo as useMemo3, useState as useState8 } from "react";
function useKitCommands(acts) {
  const [catalog, setCatalog] = useState8([]);
  useEffect7(() => {
    let alive = true;
    apiFetchJson("/api/agent/commands").then((body) => {
      if (alive)
        setCatalog(parseCatalog(body));
    }).catch(() => {
      if (alive)
        setCatalog([]);
    });
    return () => {
      alive = false;
    };
  }, []);
  const run = useCallback4(async (line, messages) => {
    const body = await apiFetchJson("/api/agent/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ line, messages })
    });
    return parseEffects(body);
  }, []);
  const suggest = useCallback4(async (line) => {
    try {
      const body = await apiFetchJson("/api/agent/command/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ line })
      });
      return parseSuggestions(body);
    } catch {
      return [];
    }
  }, []);
  const shell = useCallback4((effect) => {
    if (effect.kind === "settings") {
      acts.openSettings();
      return;
    }
    if (effect.kind === "open") {
      acts.openPiece(effect.piece);
      return;
    }
    if (effect.kind === "close")
      acts.close();
  }, [acts]);
  const commands = useMemo3(() => asKitCommands(catalog), [catalog]);
  const seam = useMemo3(() => ({ commands, catalog, run, shell }), [commands, catalog, run, shell]);
  return { seam, suggest };
}

// src/ui/agent/open-piece.ts
function pieceFor(marker, pieces) {
  return pieces.find((p) => p.kind === marker.kind && p.id === marker.id) ?? null;
}
function openMentioned(ctx, marker, pieces) {
  const piece = pieceFor(marker, pieces);
  if (!piece)
    return false;
  ctx.workbench.open(piece);
  ctx.openApp("workbench");
  return true;
}

// src/ui/agent/use-slash.ts
import { useCallback as useCallback5, useEffect as useEffect9, useMemo as useMemo4, useState as useState10 } from "react";

// src/ui/agent/slash-menu.tsx
import { useEffect as useEffect8, useState as useState9 } from "react";
import { jsxDEV as jsxDEV10 } from "react/jsx-dev-runtime";
var commandChoices = (matches) => matches.map((info) => ({ value: info.name, note: info.summary }));
function SlashMenu({
  title,
  choices,
  active,
  onPick
}) {
  const [box, setBox] = useState9(null);
  useEffect8(() => {
    box?.querySelector(".kit-slash__row--on")?.scrollIntoView({ block: "nearest" });
  }, [box, active]);
  if (choices.length === 0)
    return null;
  return /* @__PURE__ */ jsxDEV10("div", {
    className: "kit-slash",
    ref: setBox,
    role: "listbox",
    "aria-label": title,
    children: [
      /* @__PURE__ */ jsxDEV10("div", {
        className: "kit-slash__head",
        children: title
      }, undefined, false, undefined, this),
      choices.map((choice, at) => /* @__PURE__ */ jsxDEV10("button", {
        type: "button",
        role: "option",
        "aria-selected": at === active,
        className: at === active ? "kit-slash__row kit-slash__row--on" : "kit-slash__row",
        onMouseDown: (event) => {
          event.preventDefault();
          onPick(at);
        },
        children: [
          /* @__PURE__ */ jsxDEV10("span", {
            className: "kit-slash__word",
            children: choice.value
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV10("span", {
            className: "kit-slash__say",
            children: choice.note
          }, undefined, false, undefined, this)
        ]
      }, `${choice.value}${String(at)}`, true, undefined, this))
    ]
  }, undefined, true, undefined, this);
}

// src/ui/agent/use-slash.ts
function useSlash(draft, setDraft, catalog, suggest) {
  const [active, setActive] = useState10(0);
  const [dismissed, setDismissed] = useState10("");
  const [args, setArgs] = useState10({ line: "", choices: [] });
  const query = slashQuery(draft);
  const exact = query ? exactCommand(catalog, query.word) : undefined;
  const argLine = query && query.arg !== null && exact?.completes ? `${query.word} ${query.arg}` : null;
  useEffect9(() => {
    if (argLine === null) {
      setArgs({ line: "", choices: [] });
      return;
    }
    let alive = true;
    suggest(argLine).then((found) => {
      if (!alive)
        return;
      setArgs({ line: argLine, choices: found.map((one) => ({ value: one.value, note: one.note ?? "" })) });
    });
    return () => {
      alive = false;
    };
  }, [argLine, suggest]);
  const choices = useMemo4(() => {
    if (!query || dismissed === draft)
      return [];
    if (query.arg === null)
      return commandChoices(wordStageChoices(catalog, query.word));
    return args.line === argLine ? argStageChoices(args.choices, query.arg) : [];
  }, [query, dismissed, draft, catalog, args, argLine]);
  useEffect9(() => {
    setActive(0);
  }, [draft]);
  const pick = useCallback5((index) => {
    const chosen = choices[index];
    if (!chosen || !query)
      return;
    if (query.arg !== null) {
      setDraft(draftForArg(query.word, chosen.value));
      return;
    }
    const info = catalog.find((one) => one.name === chosen.value);
    setDraft(info ? draftForPick(info) : chosen.value);
  }, [choices, query, catalog, setDraft]);
  const onKey = useCallback5((event) => {
    if (event.key === "Escape" && choices.length > 0) {
      event.preventDefault();
      setDismissed(draft);
      return true;
    }
    if (choices.length === 0)
      return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => nextIndex(at, choices.length, event.key === "ArrowDown" ? 1 : -1));
      return true;
    }
    if (event.key === "Tab" || event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      pick(active);
      return true;
    }
    return false;
  }, [choices, draft, active, pick]);
  return {
    title: query?.arg === null ? "commands" : "arguments",
    choices,
    active,
    pick,
    onKey
  };
}

// src/ui/agent/use-mentions.ts
import { useCallback as useCallback6, useEffect as useEffect10, useMemo as useMemo5, useState as useState11 } from "react";

// src/kit/render/primitives/composer/mention-menu-core.ts
var TRAILING_MENTION = /(?:^|\s)(@[^\s@]*)$/;
var mentionDraft = (text3) => {
  const match = text3.match(TRAILING_MENTION);
  const draft = match?.[1] ?? "";
  return draft.includes(":") ? "" : draft;
};
var bare = (text3) => text3.toLowerCase().replace(/[^a-z0-9]+/g, "");
var matchingPieces = (pieces, draft) => {
  if (!draft.startsWith("@") || draft.includes(":"))
    return [];
  const query = draft.slice(1).toLowerCase();
  const plain = bare(query);
  return pieces.filter((piece) => !query || piece.name.toLowerCase().includes(query) || piece.kind.toLowerCase().startsWith(query) || piece.id.toLowerCase().startsWith(query) || plain !== "" && (bare(piece.name).includes(plain) || bare(piece.id).includes(plain))).slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
};
var applyMention = (text3, piece) => {
  const draft = mentionDraft(text3);
  if (!draft)
    return text3;
  return `${text3.slice(0, text3.length - draft.length)}@${piece.kind}:${piece.id} `;
};

// src/studio/collections-shape.ts
var COLLECTION_KIND = "collection";

// src/ui/agent/use-mentions.ts
function useMentions(draft, setDraft, ctx) {
  const [pieces, setPieces] = useState11([]);
  const [active, setActive] = useState11(0);
  const [dismissed, setDismissed] = useState11("");
  const { version } = useStudioChanges();
  useEffect10(() => {
    let alive = true;
    Promise.all([
      ctx.api.listEntities(),
      ctx.api.collections().then((file) => file.collections).catch(() => [])
    ]).then(([all, groupings]) => {
      if (!alive)
        return;
      setPieces([
        ...groupings.map((c) => ({ kind: COLLECTION_KIND, id: c.id, name: c.name })),
        ...all
      ]);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [ctx, version]);
  const query = mentionDraft(draft);
  const open = query !== "" && query !== dismissed;
  const matches = useMemo5(() => open ? matchingPieces(pieces, query) : [], [open, pieces, query]);
  useEffect10(() => {
    setActive(0);
  }, [query]);
  const pick = useCallback6((index) => {
    const piece = matches[index];
    if (!piece)
      return;
    setDraft(applyMention(draft, piece));
    setDismissed("");
  }, [draft, matches, setDraft]);
  const onKey = useCallback6((event) => {
    if (matches.length === 0)
      return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((n) => (n + 1) % matches.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((n) => (n - 1 + matches.length) % matches.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(active);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(query);
      return true;
    }
    return false;
  }, [active, matches.length, pick, query]);
  return {
    choices: matches.map((piece) => ({
      value: `@${piece.kind}:${piece.id}`,
      note: piece.name
    })),
    active,
    title: "Pieces",
    pick,
    onKey
  };
}

// src/ui/apps/agent/styles.ts
var PREF_BAND_FOLDED = "agent.bandFolded";
var AGENT_STYLE = `
.agent-room{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--kit-well);
  color:var(--kit-text);font-family:var(--font-mono)}

/* The header: panel ground, a seam beneath, nothing shouting. */
.agent-room__head{background:var(--kit-panel);border-bottom:1px solid var(--kit-seam);
  padding:.55rem .7rem;flex:none}
.agent-room__kick{display:flex;align-items:center;gap:.4rem;margin:0;font-size:.62rem;
  letter-spacing:.1em;text-transform:uppercase;color:var(--kit-soft);flex-wrap:wrap}
/* The alive dot from Kit's status bar: filled green when it can answer, hollow when it cannot. */
.agent-room__dot{width:.5rem;height:.5rem;border-radius:50%;flex:none;background:transparent;
  box-shadow:inset 0 0 0 1px var(--kit-mut)}
.agent-room__dot--live{background:var(--kit-alive);box-shadow:none}
.agent-room__head h1{margin:.25rem 0 0;font-family:var(--font-big);font-weight:900;
  font-size:1.15rem;line-height:1.1;color:var(--kit-text)}
.agent-room__sub{margin:.15rem 0 0;font-style:italic;color:var(--kit-soft);font-size:.8rem}

.agent-room__notice{margin:0;background:var(--kit-recess);border-left:2px solid var(--kit-gold);
  color:var(--kit-soft);padding:.5rem .7rem;font-size:.78rem;line-height:1.5;flex:none}

/* ---------- the transcript: shaded bands, spines, no rules between turns ---------- */
/*
 * THE TRANSCRIPT TAKES THE SLACK. It must not also carry .agent-room__block, which sets flex:none
 * and is declared later at the same specificity - so it silently won, the transcript could not
 * grow, and the whole conversation bunched at the top of the panel with the height falling off the
 * bottom unused. Two single-class rules setting the same property on one element is the trap.
 */
.agent-room__talk{display:flex;flex-direction:column;gap:.25rem;flex:1;min-height:0;
  overflow:auto;background:var(--kit-well);padding:.4rem 0}

.agent-room__line{display:flex;flex-direction:column;gap:.1rem;padding:.4rem .7rem;
  border-left:2px solid transparent}
/* YOUR TURN LIFTS. Kit's rule: your line is clearly raised, the reply sits back. */
.agent-room__line--user{background:var(--kit-lift);border-left-color:var(--kit-rose)}
.agent-room__line--assistant{background:var(--kit-recess);border-left-color:var(--kit-seam)}
.agent-room__line--tool{background:var(--kit-row);border-left-color:var(--kit-teal-deep)}

.agent-room__who{font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--kit-quiet)}
.agent-room__line--user .agent-room__who{color:var(--kit-rose)}
/*
  A LINE'S PROSE IS STYLED BY ITS OWN CLASS, not by a descendant element selector. The rule here
  used to be ".agent-room__line p", which was fine while a line was one paragraph and became a bug
  the moment the agent's words started rendering as markdown: a descendant selector outranks a
  single class, so it silently overrode every heading, list item and quote the renderer produced.
  The prose rules live beside the renderer now, in agent/kit-transcript-style.ts.
*/

/* Tucked under the turn, compact, never a full-width block of its own. */
.agent-room__empty{margin:0;padding:.35rem .7rem .35rem 1.4rem;color:var(--kit-quiet);
  font-style:italic;font-size:.78rem}

/* The brief: a recessed code slab on Kit's sunken field fill. */
.agent-room__block{display:flex;flex-direction:column;gap:.3rem;padding:.4rem .7rem;flex:none}
.agent-room__block summary{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--kit-quiet);cursor:pointer}
.agent-room__brief{margin:.3rem 0 0;background:var(--kit-sunken);border:1px solid var(--kit-line);
  padding:.55rem .7rem;font-family:var(--font-mono);font-size:.72rem;line-height:1.5;
  color:var(--kit-soft);white-space:pre-wrap;overflow-wrap:anywhere;max-height:22rem;overflow:auto}
`;
var AGENT_TALK_STYLE = `
/* Attached pictures, above the composer. Clicking one removes it, so the whole tile is the button. */
.agent-room__shots{display:flex;gap:.4rem;flex-wrap:wrap;padding:.4rem .5rem 0}
.agent-room__shots button{position:relative;padding:0;border:1px solid var(--kit-line);background:none;cursor:pointer;line-height:0}
.agent-room__shots img{width:3rem;height:3rem;object-fit:cover;display:block}
.agent-room__shots button:hover{border-color:var(--kit-bad)}
.agent-room__composer{position:relative;display:flex;align-items:stretch;gap:0;background:var(--kit-well);
  border-top:1px solid var(--kit-seam);padding:.5rem .7rem;flex:none}
/* The rose prompt block, fused to the field's left border. Kit: "a real stamp, not a marker". */
.agent-room__composer::before{content:">";display:flex;align-items:center;
  background:var(--kit-rose-deep);color:var(--kit-white);font-family:var(--font-mono);
  font-weight:700;font-size:.85rem;padding:0 .5rem;border:1px solid var(--kit-line);border-right:0}
.agent-room__composer textarea{flex:1;resize:none;min-height:2.2rem;max-height:9rem;
  background:var(--kit-panel);border:1px solid var(--kit-line);color:var(--kit-text);
  padding:.4rem .55rem;font-family:var(--font-body);font-size:.83rem;line-height:1.5}
.agent-room__composer textarea::placeholder{color:var(--kit-quiet)}
.agent-room__composer textarea:focus{outline:none;border-color:var(--kit-rose)}
.agent-room__composer textarea:disabled{color:var(--kit-quiet);cursor:not-allowed}
.agent-room__composer button{flex:none;border:1px solid var(--kit-line);border-left:0;
  background:var(--kit-panel);color:var(--kit-text);font-family:var(--font-mono);font-weight:700;
  font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;padding:0 .8rem;cursor:pointer}
.agent-room__composer button:hover:not(:disabled){background:var(--kit-lift)}
.agent-room__composer button:disabled{color:var(--kit-quiet);cursor:not-allowed}
/* Stopping is the rose act while a turn runs, the way "working" turns rose in Kit's status bar. */
.agent-room__stop{flex:none;border:1px solid var(--kit-line);border-left:0;
  background:var(--kit-rose-deep);color:var(--kit-white);font-family:var(--font-mono);
  font-weight:700;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  padding:0 .8rem;cursor:pointer}
`;
var AGENT_CHIP_STYLE = `
/* the band fold: a hairline key in the corner, never competing with the conversation */
.agent-room__fold{position:absolute;top:.15rem;right:.35rem;z-index:2;background:transparent;
  border:none;cursor:pointer;color:var(--kit-quiet);font-size:.7rem;line-height:1;padding:.15rem .3rem}
.agent-room__fold:hover{color:var(--kit-text)}
/* queued messages: waiting, and visibly so. A send that sat silent would read as one that failed. */
.agent-room__queue{list-style:none;margin:0;padding:.25rem .7rem;display:flex;flex-direction:column;gap:.25rem;flex:none}
.agent-room__queue li{display:flex;align-items:center;gap:.4rem;min-width:0;
  border-left:2px solid var(--kit-verb-ask);padding-left:.45rem}
.agent-room__queuekick{font-family:var(--kit-mono);font-size:.5rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--kit-quiet);flex:none}
.agent-room__queuetext{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:.75rem;color:var(--kit-soft)}
.agent-room__queue button{flex:none;background:transparent;border:1px solid var(--kit-line);
  color:var(--kit-quiet);cursor:pointer;font-family:var(--kit-mono);font-size:.5rem;
  letter-spacing:.1em;text-transform:uppercase;padding:.15rem .35rem}
.agent-room__queue button:hover{color:var(--kit-text);border-color:var(--kit-mut)}
.agent-room__chips{display:flex;flex-wrap:wrap;gap:.3rem;padding:.3rem .7rem;flex:none}
.agent-room__chips button{background:var(--kit-stamp);border:1px solid var(--kit-line);
  color:var(--kit-soft);font-family:var(--font-mono);font-size:.62rem;letter-spacing:.1em;
  text-transform:uppercase;padding:.25rem .55rem;cursor:pointer}
.agent-room__chips button:hover:not(:disabled){background:var(--kit-lift);color:var(--kit-text)}
.agent-room__chips button:disabled{color:var(--kit-quiet);cursor:not-allowed}
`;
var AGENT_GATE_STYLE = `
.gate-card{display:flex;flex-direction:column;gap:.4rem;margin:.4rem .7rem;flex:none;
  background:var(--kit-panel);border:1px solid var(--kit-rose);
  border-left:3px solid var(--kit-rose);padding:.6rem .7rem}
.gate-card__kick{margin:0;font-family:var(--font-mono);font-size:.58rem;letter-spacing:.18em;
  text-transform:uppercase;color:var(--kit-rose)}
.gate-card__title{font-family:var(--font-big);font-weight:900;font-size:.95rem;
  color:var(--kit-bright)}
.gate-card__why{margin:0;font-size:.78rem;color:var(--kit-soft)}
/* The warnings carry gold: they are the reason to say no, and Kit never mutes what it confides. */
.gate-card__warnings{margin:0;padding-left:1rem;display:flex;flex-direction:column;gap:.15rem}
.gate-card__warnings li{font-size:.78rem;color:var(--kit-gold)}
.gate-card__detail{margin:0;background:var(--kit-sunken);border:1px solid var(--kit-line);
  padding:.5rem .6rem;font-family:var(--font-mono);font-size:.7rem;line-height:1.5;
  color:var(--kit-soft);white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow:auto}
.gate-card__row{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.15rem}
.gate-card__row button{background:var(--kit-floor);border:1px solid var(--kit-line);
  color:var(--kit-soft);font-family:var(--font-mono);font-weight:700;font-size:.64rem;
  letter-spacing:.08em;text-transform:uppercase;padding:.28rem .6rem;cursor:pointer}
.gate-card__row button:hover:not(:disabled){background:var(--kit-lift);color:var(--kit-text)}
.gate-card__row button:disabled{color:var(--kit-quiet);cursor:not-allowed}
.gate-card__yes{color:var(--kit-teal);border-color:var(--kit-teal-deep)}
.gate-card__abort{margin-left:auto;color:var(--kit-red);border-color:var(--kit-rose-deep)}
`;
var AGENT_KIT_STYLE = `
/* The elapsed clock: a small deep-rose stamp with white digits, everywhere Kit uses one. */
.kit-stamp{background:var(--kit-rose-deep);color:var(--kit-white);font-family:var(--font-mono);
  font-size:.62rem;padding:0 .35rem;letter-spacing:.04em;flex:none}

/* The stagehand. Hushed: it sits in the transcript rather than on top of it. */
.kit-stagehand{display:flex;align-items:center;gap:.4rem;padding:.35rem .7rem .35rem 1.4rem;
  font-family:var(--font-mono);font-size:.72rem;color:var(--kit-mut)}
.kit-stagehand__dot{font-size:.9rem;line-height:1}
.kit-stagehand__verb{color:var(--kit-quiet)}

/* The open rehearsal: a dim seam-bordered box, never sharing the stage with the stagehand. */
.kit-rehearsal{margin:.25rem .7rem;background:var(--kit-recess);border:1px solid var(--kit-seam);
  border-left:2px solid var(--kit-rose-deep)}
.kit-rehearsal__head{display:flex;align-items:center;justify-content:space-between;
  padding:.2rem .4rem;font-family:var(--font-mono);font-size:.56rem;letter-spacing:.2em;
  color:var(--kit-mut)}
.kit-rehearsal__text{margin:0;padding:.35rem .5rem .45rem;font-family:var(--font-mono);
  font-size:.7rem;line-height:1.5;color:var(--kit-quiet);white-space:pre-wrap;
  overflow-wrap:anywhere;max-height:9rem;overflow:hidden}

/* The landed trace: one indented line, not a megablock. */
.kit-trace{padding:.15rem .7rem .15rem 1.4rem}
.kit-trace__line{background:none;border:0;padding:0;cursor:pointer;font-family:var(--font-mono);
  font-size:.68rem;color:var(--kit-mut);text-align:left}
.kit-trace__line:hover{color:var(--kit-quiet)}
.kit-trace__full{margin:.3rem 0 0;font-family:var(--font-mono);font-size:.7rem;line-height:1.5;
  color:var(--kit-quiet);white-space:pre-wrap;overflow-wrap:anywhere}

/* The watcher: a framed aside in gold, because it is the one line that is nobody talking. */
.kit-watch{margin:.25rem .7rem;background:var(--kit-floor);border:1px solid var(--kit-seam);
  border-left:2px solid var(--kit-gold)}
.kit-watch__head{padding:.2rem .4rem;font-family:var(--font-mono);font-size:.56rem;
  letter-spacing:.2em;color:var(--kit-mut)}
.kit-watch__text{margin:0;padding:0 .5rem .35rem;font-size:.75rem;color:var(--kit-soft)}

/* The searchlight, flush on the composer's top edge so the two read as one unit. */
.kit-sweep{position:absolute;top:-1px;left:0;right:0;height:1px;overflow:hidden;pointer-events:none}
.kit-sweep::before{content:"";position:absolute;top:0;bottom:0;width:34%;
  background:linear-gradient(90deg,transparent,var(--kit-rose-deep),var(--kit-rose),
    var(--kit-rose-deep),transparent);
  animation:kit-sweep 11400ms linear infinite}
@keyframes kit-sweep{from{transform:translateX(-100%)}to{transform:translateX(394%)}}

.kit-hints{display:flex;flex-wrap:wrap;gap:.5rem;padding:.2rem .7rem;font-family:var(--font-mono);
  font-size:.62rem}
.kit-hints__pair{display:inline-flex;gap:.25rem;align-items:baseline}
.kit-hints__key{color:var(--kit-bright)}
.kit-hints__label{color:var(--kit-mut)}

@media (prefers-reduced-motion: reduce){
  /* The beam holds still and the dot stops breathing; both still say what they say. */
  .kit-sweep__rule{animation:none;background:none;color:var(--kit-rose-deep)}
}
`;

// src/ui/apps/agent/room.tsx
import { jsxDEV as jsxDEV11, Fragment as Fragment3 } from "react/jsx-dev-runtime";
function AgentRoom({ ctx, onClose }) {
  const [, bump] = useState12(0);
  useEffect11(() => ctx.agent.onChange(() => {
    bump((n) => n + 1);
  }), [ctx]);
  useEffect11(() => onHtmlHandoff(() => {
    ctx.openApp(HTML_VIEW_APP);
  }), [ctx]);
  const [draft, setDraftState] = useState12(loadDraft);
  const setDraft = useCallback7((next) => {
    setDraftState(next);
    saveDraft(next);
  }, []);
  const [bandFolded, setBandFolded] = useState12(() => ctx.prefs.get(PREF_BAND_FOLDED) === true);
  const [traceOpen, setTraceOpen] = useState12(false);
  const [model, setModel] = useState12({ connected: false });
  const changes = useStudioChanges();
  const endRef = useRef6(null);
  const composerRef = useRef6(null);
  useEffect11(() => {
    composerRef.current?.focus();
  }, []);
  const { notice, say } = useNotice();
  const post = useMemo6(() => (body, signal) => apiFetch("/api/agent/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal
  }), []);
  const postGate = useMemo6(() => (body) => apiFetchJson("/api/agent/gate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }), []);
  const shellActs = useMemo6(() => ({
    openSettings: () => {
      window.location.hash = "settings/models";
      ctx.openApp("settings");
    },
    openPiece: (piece) => {
      ctx.api.listEntities().then((all) => {
        if (openMentioned(ctx, piece, all))
          return;
        ctx.setStatus(`${piece.kind} ${piece.id} is not in the studio any more`);
      }).catch(() => {
        ctx.setStatus("could not reach the studio to open that piece");
      });
    },
    close: () => {
      if (onClose) {
        onClose();
        return;
      }
      const published2 = ctx.agent.current();
      if (published2)
        ctx.openApp(published2.appId);
    }
  }), [ctx, onClose]);
  const kitCommands = useKitCommands(shellActs);
  const chat = useAgentChat(post, postGate, kitCommands.seam);
  useEffect11(() => {
    apiFetchJson("/api/agent/provider").then(setModel).catch(() => {
      setModel({ connected: false });
    });
  }, []);
  useEffect11(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.lines, chat.streaming, chat.gate]);
  const published = ctx.agent.current();
  const from = published ? ctx.apps().find((m) => m.id === published.appId) : undefined;
  const reading = from ? readSurface({ id: from.id, title: from.title, ...from.agentSurface ? { agentSurface: from.agentSurface } : {} }, published?.state ?? null) : null;
  const brief = reading ? briefText(reading) : undefined;
  const [shots, setShots] = useState12([]);
  const attach = useCallback7((files) => {
    for (const file of files.slice(0, 4)) {
      if (!file.type.startsWith("image/"))
        continue;
      const reader = new FileReader;
      reader.onload = () => {
        const url = typeof reader.result === "string" ? reader.result : "";
        if (url)
          setShots((prior) => prior.length >= 4 ? prior : [...prior, url]);
      };
      reader.readAsDataURL(file);
    }
  }, []);
  const submit = () => {
    const text3 = draft;
    const carried = shots;
    setDraft("");
    setShots([]);
    chat.send(text3, brief, carried.length ? carried : undefined);
  };
  const slash = useSlash(draft, setDraft, kitCommands.seam.catalog, kitCommands.suggest);
  const mentions = useMentions(draft, setDraft, ctx);
  const acts = useMemo6(() => ({
    onSend: (line) => {
      chat.send(line, brief);
    },
    onRewind: chat.rewind
  }), [chat, brief]);
  const onComposerKey = (event) => {
    if (slash.onKey(event))
      return;
    if (mentions.onKey(event))
      return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };
  return /* @__PURE__ */ jsxDEV11("section", {
    className: "agent-room",
    style: kitVars(),
    children: [
      /* @__PURE__ */ jsxDEV11("style", {
        children: AGENT_STYLE + AGENT_TALK_STYLE + AGENT_CHIP_STYLE + AGENT_GATE_STYLE + AGENT_KIT_STYLE + KIT_TRANSCRIPT_STYLE + KIT_COMMAND_STYLE
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11("button", {
        type: "button",
        className: "agent-room__fold",
        "aria-expanded": !bandFolded,
        title: bandFolded ? "Show the model and screen" : "Fold this band away",
        onClick: () => {
          setBandFolded(!bandFolded);
          ctx.prefs.set(PREF_BAND_FOLDED, !bandFolded);
        },
        children: bandFolded ? "▸" : "▾"
      }, undefined, false, undefined, this),
      !bandFolded && /* @__PURE__ */ jsxDEV11("header", {
        className: "agent-room__head",
        children: [
          /* @__PURE__ */ jsxDEV11("p", {
            className: "agent-room__kick",
            children: [
              /* @__PURE__ */ jsxDEV11("span", {
                className: `agent-room__dot${model.connected ? " agent-room__dot--live" : ""}`
              }, undefined, false, undefined, this),
              model.connected ? `${model.provider ?? "model"} · ${model.model ?? ""}` : "no model connected",
              changes.watching ? "" : "  ·  not watching the studio folder"
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV11("h1", {
            children: "The Agent"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("p", {
            className: "agent-room__sub",
            children: reading ? `Standing on ${reading.title}.` : "No screen has described itself yet. Open another app and come back."
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV11(MeterBar, {
        tokens: chat.tokens,
        maxContext: model.context
      }, undefined, false, undefined, this),
      !model.connected && /* @__PURE__ */ jsxDEV11("p", {
        className: "agent-room__notice",
        children: "No model is connected. Add one in Settings; this window uses the same vault and the same providers as Kit, so anything set up there works here."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11("section", {
        className: "agent-room__talk",
        children: [
          chat.lines.length === 0 && !chat.streaming && /* @__PURE__ */ jsxDEV11("p", {
            className: "agent-room__empty",
            children: "Ask about what is on the screen behind this window."
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11(Transcript, {
            lines: chat.lines,
            streaming: chat.streaming,
            busy: chat.busy,
            problem: chat.problem,
            acts,
            onFold: chat.setFold,
            onNotice: say,
            onAnswer: (index, message) => {
              chat.answerChoice(index, message, brief);
            }
          }, undefined, false, undefined, this),
          chat.busy && chat.rehearsal ? /* @__PURE__ */ jsxDEV11(Rehearsal, {
            text: chat.rehearsal,
            startedAt: chat.startedAt
          }, undefined, false, undefined, this) : chat.busy && !chat.streaming && !chat.gate ? /* @__PURE__ */ jsxDEV11(Stagehand, {
            startedAt: chat.startedAt
          }, undefined, false, undefined, this) : null,
          !chat.busy && chat.trace && /* @__PURE__ */ jsxDEV11(RehearsalTrace, {
            text: chat.trace.text,
            seconds: chat.trace.seconds,
            open: traceOpen,
            onToggle: () => {
              setTraceOpen((v) => !v);
            }
          }, undefined, false, undefined, this),
          changes.version > 0 && /* @__PURE__ */ jsxDEV11(WatchNote, {
            kinds: changes.kinds
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            ref: endRef
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV11(StatusToast, {
        text: notice
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11(GateCard, {
        request: chat.gate,
        onAnswer: chat.answerGate
      }, undefined, false, undefined, this),
      reading && reading.actions.length > 0 && model.connected && !chat.gate && /* @__PURE__ */ jsxDEV11("div", {
        className: "agent-room__chips",
        children: reading.actions.map((action) => /* @__PURE__ */ jsxDEV11("button", {
          type: "button",
          disabled: chat.busy,
          onClick: () => {
            chat.send(action.describe, brief);
          },
          children: action.label
        }, action.id, false, undefined, this))
      }, undefined, false, undefined, this),
      chat.queued.length > 0 && /* @__PURE__ */ jsxDEV11("ul", {
        className: "agent-room__queue",
        children: chat.queued.map((text3, at) => /* @__PURE__ */ jsxDEV11("li", {
          children: [
            /* @__PURE__ */ jsxDEV11("span", {
              className: "agent-room__queuekick",
              children: "waiting"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV11("span", {
              className: "agent-room__queuetext",
              children: text3
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV11("button", {
              type: "button",
              title: "Stop the turn and send this now",
              onClick: () => {
                chat.sendQueuedNow(at);
              },
              children: "send now"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV11("button", {
              type: "button",
              title: "Forget this one",
              onClick: () => {
                chat.dropQueued(at);
              },
              children: "drop"
            }, undefined, false, undefined, this)
          ]
        }, `${String(at)}:${text3.slice(0, 24)}`, true, undefined, this))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11("div", {
        className: "agent-room__compose",
        children: [
          /* @__PURE__ */ jsxDEV11(SlashMenu, {
            title: slash.title,
            choices: slash.choices,
            active: slash.active,
            onPick: slash.pick
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11(SlashMenu, {
            title: mentions.title,
            choices: mentions.choices,
            active: mentions.active,
            onPick: mentions.pick
          }, undefined, false, undefined, this),
          shots.length > 0 && /* @__PURE__ */ jsxDEV11("div", {
            className: "agent-room__shots",
            children: shots.map((src, at) => /* @__PURE__ */ jsxDEV11("button", {
              type: "button",
              title: "Remove this picture",
              onClick: () => {
                setShots((prior) => prior.filter((_, i) => i !== at));
              },
              children: /* @__PURE__ */ jsxDEV11("img", {
                src,
                alt: "attached"
              }, undefined, false, undefined, this)
            }, at, false, undefined, this))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("form", {
            className: "agent-room__composer",
            onSubmit: (e) => {
              e.preventDefault();
              submit();
            },
            children: [
              /* @__PURE__ */ jsxDEV11(Searchlight, {
                on: chat.busy
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV11("textarea", {
                ref: composerRef,
                value: draft,
                rows: 2,
                onPaste: (e) => {
                  const files = [...e.clipboardData.files];
                  if (files.length === 0)
                    return;
                  e.preventDefault();
                  attach(files);
                },
                spellCheck: true,
                placeholder: model.connected ? "Ask about this screen, or type / for a command" : "Type / for a command, or connect a model in Settings",
                onChange: (e) => {
                  setDraft(e.target.value);
                },
                onKeyDown: onComposerKey
              }, undefined, false, undefined, this),
              chat.busy ? /* @__PURE__ */ jsxDEV11(Fragment3, {
                children: [
                  /* @__PURE__ */ jsxDEV11("button", {
                    type: "submit",
                    disabled: !draft.trim(),
                    title: "Send this when the turn finishes",
                    children: "Queue"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV11("button", {
                    type: "button",
                    className: "agent-room__stop",
                    onClick: chat.stop,
                    children: "Stop"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV11("button", {
                type: "submit",
                disabled: !draft.trim() || !model.connected && !draft.trim().startsWith("/"),
                children: draft.trim().startsWith("/") ? "Run" : "Ask"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV11(KeyHints, {
        hints: [
          { key: "enter", label: "send" },
          { key: "shift+enter", label: "newline" },
          { key: "/", label: "commands" },
          { key: "ctrl+/", label: "hide" }
        ]
      }, undefined, false, undefined, this),
      reading && /* @__PURE__ */ jsxDEV11("details", {
        className: "agent-room__block",
        children: [
          /* @__PURE__ */ jsxDEV11("summary", {
            children: "What it can see"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("pre", {
            className: "agent-room__brief",
            children: brief
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/agent/index.tsx
import { jsxDEV as jsxDEV12 } from "react/jsx-dev-runtime";
var MARK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + '<path d="M4 5.5h16v10H12l-5 4v-4H4z" stroke-linejoin="round"/>' + '<path d="M11 8.5v4"/>' + "</svg>";
var app = {
  manifest: {
    id: "agent",
    title: "The Agent",
    markSvg: MARK_SVG,
    accent: "#0f9b8e",
    order: 40,
    subtitle: "app · agent",
    agentSurface: {
      describe: "The agent's own window. Shows what it can see on the screen you were last standing on, and the brief it would be given.",
      actions: [
        {
          id: "explain-surface",
          label: "Explain this screen",
          describe: "Say what the current screen is showing and what would be worth doing on it."
        }
      ]
    }
  },
  Component: ({ ctx }) => /* @__PURE__ */ jsxDEV12(AgentRoom, {
    ctx
  }, undefined, false, undefined, this)
};
var agent_default = app;
export {
  agent_default as default
};
