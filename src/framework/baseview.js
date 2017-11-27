'use strict';
var $ = require('./domhelpers.js');
var pluginManager = require('./pluginmanager.js');
var parseManager = require('./parsemanager.js');
var DOMObserver = require('./observer/domobserver.js');

/**
 * Base class for a view
 */
var BaseView = DOMObserver.extend({

  /**
   * Will initialise the view
   */
  constructor: function(options) {
    options = options || {};
    DOMObserver.call(this);

    this._cache = {}; // this will cache some properties. The cache can be deleted an the method will need to rebuild the data. Therefore don't query the _cache directly, but use the accessor functions.
    this.childType = options.childType;
    this._setDocument(options);

    // parent if defined
    this.parent = options.parent;
    this.innerEl = this.innerEl || options.el;
    // backlink from DOM to object
    if (this.innerEl._ljView) throw "trying to initialialize view on element that already has a view";
    this.innerEl._ljView = this;
    // possible wrapper element
    this.outerEl = this.outerEl || options.el || this.innerEl;
    this.outerEl._ljView = this;

    if (!this.parent && this.outerEl._state && this.outerEl._state.view) {
      this.parent = this.outerEl._state.parent.view;
    }

    var state = layerJS.getState(this.document);
    state.registerView(this);

    this.setOriginalHeight();
    this.setOriginalWidth();
    this._parseChildren();
    this.registerEventHandlers();
    this.startObserving();
  },
  /* jshint ignore:start */
  /**
   *  Will start observing the current DOM Element. This is an abstract method and should be implemented
   *  by views who inherit from this class.
   */
  startObserving: function() {

  },
  /* jshint ignore:end */
  /**
   * Will add eventhandlers to specific events. By default is will call the _parseChildren when a
   * 'childrenChanged' event is triggered.
   */
  registerEventHandlers: function() {
    this.on('childrenChanged', function(result) {
      if ((result.addedNodes && result.addedNodes.length > 0) || (result.removedNodes && result.removedNodes.length > 0)) {
        this._parseChildren({
          addedNodes: result.addedNodes,
          removedNodes: result.removedNodes
        });
      }
    });
  },
  /**
   * Will parse the current DOM Element it's children.
   * Will trigger childAdded and/or childRemoved.
   * @param {object} options - optional: includes addedNodes, removedNodes
   */
  _parseChildren: function(options) {
    options = options || {};
    var that = this;
    var childrenRemoved = [];
    var childrenAdded = [];
    this._cache.children = [];
    this._cache.childNames = {};
    this._cache.childIDs = {};


    // trigger remove nodes first. this is important for inter stage transitions
    if (options.removedNodes && options.removedNodes.length > 0) {
      options.removedNodes.forEach(function(removedNode) {
        if (removedNode._ljView) {
          childrenRemoved.push(removedNode._ljView);
        }
      });
    }

    if (this.childType) {
      for (var i = 0; i < this.innerEl.children.length; i++) {
        var child = this.innerEl.children[i];
        if (!child._ljView && $.getAttributeLJ(child, 'type') === this.childType) {
          pluginManager.createView(this.childType, {
            el: child,
            parent: this,
            document: this.document
          });
          this._renderChildPosition(child._ljView);
          childrenAdded.push(child._ljView);
        }
        if (child._ljView && child._ljView.type() === this.childType) {
          var cv = child._ljView;
          this._cache.children.push(cv);
          this._cache.childNames[cv.name()] = cv;
          this._cache.childIDs[cv.id()] = cv;
        }
      }
    }

    if (options.addedNodes && options.addedNodes.length > 0) {
      var length = options.addedNodes.length;
      for (var x = 0; x < length; x++) {
        // check if added nodes don't already have a view defined.
        if (options.addedNodes[x].parentElement !== this.innerEl) continue;
        if (!options.addedNodes[x]._ljView) {
          parseManager.parseElement(options.addedNodes[x].parentNode, {
            parent: this
          });
        } else if (options.addedNodes[x]._ljView.parent !== this) {
          // check if added node has the same parent
          options.addedNodes[x]._ljView.parent = this;
        }
        if (options.addedNodes[x]._ljView) {
          childrenAdded.push(options.addedNodes[x]._ljView);
        }
      }
    }

    childrenRemoved.forEach(function(view) {
      that.trigger('childRemoved', view);
    });

    childrenAdded.forEach(function(view) {
      that.trigger('childAdded', view);
    });

  },
  /**
   * Will return a childview by a specific name
   *
   * @param {String} name - the name of the child view to get
   * @returns {Object} a child view
   */
  getChildViewByName: function(name) {
    if (!this._cache.childNames) this._parseChildren();
    return this._cache.childNames[name];
  },
  /**
   * Will return the child views of the view
   * @returns {Object} a hashed object with child views
   */
  getChildViews: function() {
    if (!this._cache.children) this._parseChildren();
    return this._cache.children;
  },
  /**
   * Will determin which document object should be associated with this view
   * @param {result} an object that contains what has been changed on the DOM element
   * @return {void}
   */
  _setDocument: function(options) {
    this.document = document;

    if (options) {
      if (options.document) {
        this.document = options.document;
      } else if (options.el) {
        this.document = options.el.ownerDocument;
      }
    }
  },
  /* jshint ignore:start */
  /**
   * Will place a child view at the correct position. This is an abstract method and should be implemented
   *  by views who inherit from this class.
   * @param {Object} childView - the childView
   */
  _renderChildPosition: function(childView) {

  },
  /* jshint ignore:end */
  /**
   * apply CSS styles to this view
   *
   * @param {Object} arguments - List of styles that should be applied
   * @returns {Type} Description
   */
  applyStyles: function() {
    var len = arguments.length;
    for (var j = 0; j < len; j++) {
      var props = Object.keys(arguments[j]); // this does not run through the prototype chain; also does not return special
      for (var i = 0; i < props.length; i++) {
        if ($.cssPrefix[props[i]]) this.outerEl.style[$.cssPrefix[props[i]]] = arguments[j][props[i]];
        // do standard property as well as newer browsers may not accept their own prefixes  (e.g. IE & edge)
        this.outerEl.style[props[i]] = arguments[j][props[i]];
      }
    }
  },
  /**
   * Will set an lj-* attribute on the outer element
   *
   * @param {String} name - the name of the attribute (without lj prefix)
   * @param {String} data - the value of the attribute
   */
  setAttributeLJ: function(name, data) {
    $.setAttributeLJ(this.outerEl, name, data);
  },
  /**
   * Will get the value of an lj-* attribute on the outer element
   *
   * @param {String} name - the name of the attribute (without lj prefix)
   * @return {String} the value of the attribute
   */
  getAttributeLJ: function(name) {
    return $.getAttributeLJ(this.outerEl, name);
  },
  /**
   * Will get the value of an attribute on the outer element
   *
   * @param {String} name - the name of the attribute
   * @return {String} the value of the attribute
   */
  getAttribute: function(name) {
    return this.outerEl.getAttribute(name);
  },
  /**
   * Will return the id of the view. Will use the value of the lj-id or id or an unique generated id.
   *
   * @return {String} the id of the view
   */
  id: function() {
    if (!this._id) {
      this._id = this.getAttributeLJ('id') || this.outerEl.id || $.uniqueID(this.type(), this.document);
    }
    return this._id;
  },
  /**
   * Will return the name of the view. Will use the value of lj-name or the id method.
   *
   * @return {String} the name of the view
   */
  name: function() {
    return this.getAttributeLJ('name') || this.outerEl.id || this.id();
  },
  /**
   * Will return the type of the view
   *
   * @return {String} the type of the view
   */
  type: function() {
    return this.getAttributeLJ('type');
  },
  /**
   * Will return the node type of the outer element
   *
   * @return {String} the node type of the outer element
   */
  nodeType: function() {
    return this.outerEl && this.outerEl.nodeType;
  },
  /**
   * Will return the width of the view
   *
   * @return {Number} the width of the view
   */
  width: function() {
    var width = this.getAttributeLJ('width') || this.getAttribute('width'); // prefer explicit width
    if (width !== null) {
      this.setWidth(width); // if we had an explicit width we need to apply this.
    } else {
      width = this.outerEl.offsetWidth || this.outerEl.style.width || 0; // else take width of element
    }
    return $.parseDimension(width, this.outerEl);
  },
  /**
   * Will return the height of the view (including the margins)
   *
   * @return {Number} the height of the view
   */
  height: function() {
    var height = this.getAttributeLJ('height') || this.getAttribute('height'); // prefer explicit height
    if (height !== null) {
      this.setHeight(height); // if we had an explicit height we need to apply this.
    } else {
      height = this.outerEl.offsetHeight || this.outerEl.style.height || 0; // else take height of element
    }
    return $.parseDimension(height, this.outerEl);
  },
  /**
   * Will set the width of the view (excluding the margins)
   *
   * @param {Number} width
   */
  setWidth: function(width) {
    width = $.parseDimension(width, this.outerEl);
    var margin = this.getMargin();
    var marginToSubtract = margin.left + margin.right;

    this.outerEl.style.width = width - marginToSubtract + 'px';
  },
  /**
   * Will set the width of the view (excluding the margins)
   *
   * @param {Number} height
   */
  setHeight: function(height) {
    height = $.parseDimension(height, this.outerEl);
    var margin = this.getMargin();
    var marginToSubtract = margin.top + margin.bottom;

    this.outerEl.style.height = height - marginToSubtract + 'px';
  },
  /**
   * Will return the x value of the view. This method will use
   *  the offsetLeft or style.left or the lj-x attribute of the outer element
   *
   * @return {Number} the x (left) of the outer element
   */
  x: function() {
    var x = this.getAttributeLJ('x');
    x = (x !== null && (this.outerEl.style.left = $.parseDimension(x) + 'px') && x) || this.outerEl.offsetLeft || this.outerEl.style.left || 0;
    return $.parseDimension(x, this.outerEl);
  },
  /**
   * Will return the y value of the view. This method will use
   *  the offsetTop or style.top or the lj-y attribute of the outer element
   *
   * @return {Number} the y (top) of the outer element
   */
  y: function() {
    var y = this.getAttributeLJ('y');
    y = (y !== null && (this.outerEl.style.top = $.parseDimension(y) + 'px') && y) || this.outerEl.offsetTop || this.outerEl.style.top || 0;
    return $.parseDimension(y);
  },
  /**
   * Will return the value of the lj-scale-x attribute on the outer element
   *
   * @return {string} the value of the lj-scale-x attribute
   */
  scaleX: function() {
    var scaleX = this.getAttributeLJ('scale') || this.getAttributeLJ('scale-x');

    return scaleX ? parseFloat(scaleX) : 1;
  },
  /**
   * Will return the value of the lj-scale-y attribute on the outer element
   *
   * @return {string} the value of the lj-scale-y attribute
   */
  scaleY: function() {
    var scaleY = this.getAttributeLJ('scale') || this.getAttributeLJ('scale-y');

    return scaleY ? parseFloat(scaleY) : 1;
  },
  /**
   * Will return the value of the lj-fit-to attribute on the outer element.
   * The default value is 'width'.
   *
   * @param {boolean} useFallBack (optional) when false, the fallback value will not be used
   * @return {string} the value of the lj-fit-to attribute
   */
  fitTo: function(useFallBack) {
    var fitTo = this.getAttributeLJ('fit-to');

    if (useFallBack !== false && !fitTo) {
      fitTo = 'width';
    }

    return fitTo;
  },
  /**
   * Will return the value of the lj-elastic-left attribute on the outer element
   *
   * @return {string} the value of the lj-elastic-left attribute
   */
  elasticLeft: function() {
    return this.getAttributeLJ('elastic-left');
  },
  /**
   * Will return the value of the lj-elastic-right attribute on the outer element
   *
   * @return {string} the value of the lj-elastic-right attribute
   */
  elasticRight: function() {
    return this.getAttributeLJ('elastic-right');
  },
  /**
   * Will return the value of the lj-elastic-top attribute on the outer element
   *
   * @return {string} the value of the lj-elastic-top attribute
   */
  elasticTop: function() {
    return this.getAttributeLJ('elastic-top');
  },
  /**
   * Will return the value of the lj-elastic-bottom attribute on the outer element
   *
   * @return {string} the value of the lj-elastic-bottom attribute
   */
  elasticBottom: function() {
    return this.getAttributeLJ('elastic-bottom');
  },
  /**
   * Will return the value of the lj-start-position attribute on the outer element.
   * The default value is 'toUpperCase'.
   *
   * @return {string} the value of the lj-start-position attribute
   */
  startPosition: function() {
    return this.getAttributeLJ('start-position') || 'top-left';
  },
  /**
   * Will return the value of the lj-no-scrolling attribute on the outer element.
   * The default value is false.
   *
   * @return {Boolean} the value of the lj-no-scrolling attribute
   */
  noScrolling: function() {
    var noScrolling = this.getAttributeLJ('no-scrolling');
    return noScrolling ? noScrolling === 'true' : false;
  },
  /**
   * Will return the value of the lj-rotation attribute on the outer element.
   *
   * @return {String} the value of the lj-rotation attribute
   */
  rotation: function() {
    return this.getAttributeLJ('rotation');
  },
  /**
   * Will return all the neighbors of a view
   *
   * @return {Object} object that returns the l,r,t,b neighbors of the view
   */
  neighbors: function() {
    var neighbors = {
      l: this.getAttributeLJ('neighbors.l'),
      r: this.getAttributeLJ('neighbors.r'),
      t: this.getAttributeLJ('neighbors.t'),
      b: this.getAttributeLJ('neighbors.b')
    };

    return neighbors;
  },
  /*layer*/
  /**
   * Will return the value of the lj-layout-type attribute on the outer element.
   * The default value is 'slide'.
   *
   * @return {string} the value of the lj-layout-type attribute
   */
  layoutType: function() {
    return this.getAttributeLJ('layout-type') || this.getAttributeLJ('layout') || 'slide';
  },
  /**
   * Will return the value of the lj-default-frame attribute on the outer element.
   *
   * @return {string} the value of the lj-default-frame attribute
   */
  defaultFrame: function() {
    return this.getAttributeLJ('default-frame');
  },
  /**
   * return the desired transition of a frame or layer of defined
   *
   * @returns {string} transition type
   */
  defaultTransition: function() {
    return this.getAttributeLJ('transition');
  },
  /**
   * Will return the value of the lj-native-scroll attribute on the outer element.
   * The default value is false.
   *
   * @return {Boolean} the value of the lj-native-scroll attribute
   */
  nativeScroll: function() {
    var nativeScroll = this.getAttributeLJ('native-scroll');
    return nativeScroll ? nativeScroll === 'true' : true;
  },
  /**
   * Will set the value of the lj-native-scroll attribute on the outer element.
   *
   * @param {Boolean} nativeScrolling - the value to set
   */
  setNativeScroll: function(nativeScroll) {
    this.setAttributeLJ('native-scroll', nativeScroll);
  },
  /**
   * Will return the margin for the outerEl
   *
   * @return {Object}
   */
  getMargin: function() {
    var computedStyle = this.computedStyle();

    return {
      top: $.parseDimension(computedStyle.getPropertyValue('margin-top') || '0'),
      bottom: $.parseDimension(computedStyle.getPropertyValue('margin-bottom') || '0'),
      right: $.parseDimension(computedStyle.getPropertyValue('margin-right') || '0'),
      left: $.parseDimension(computedStyle.getPropertyValue('margin-left') || '0'),
    };
  },
  /**
   * Will return if the layer should show it's frame in the url
   *
   * @return {Boolean} the value of the lj-no-url attribute
   */
  noUrl: function() {
    var noUrl = this.getAttributeLJ('no-url');

    return noUrl === 'true' ? true : false;
  },
  /**
   * returns the value for lj-timer which is used for auto trigger transitions.
   *
   * @param {Type} Name - Description
   * @returns {Type} Description
   */
  timer: function() {
    return this.getAttributeLJ('timer');
  },
  /**
   * returns the value for lj-auto-height
   *
   * @returns {string} A layername
   */
  autoHeight: function() {
    return this.getAttributeLJ('auto-height');
  },
  /**
   * returns the value for lj-auto-width
   *
   * @returns {string} A layername
   */
  autoWidth: function() {
    return this.getAttributeLJ('auto-width');
  },

  /** Will return if the layer allows dragging
   *
   * @return {Boolean} the value of the lj-draggable attribute
   */
  draggable: function() {
    var draggable = this.getAttributeLJ('draggable');
    return draggable === 'true' ? true : false;
  },
  /**
   * ##destroy
   * This element was requested to be deleted completly; before the delete happens
   * an event is triggerd on which this function id bound (in `initialialize`). It
   * will remove the DOM elements connected to this element.
   * @return {void}
   */
  destroy: function() {
    this.unobserve();
    this.outerEl.parentNode.removeChild(this.outerEl);
  },
  /**
   * returns the value for the css content property
   *
   * @returns {string} css content value
   */
  cssContent: function() {
    return (this.computedStyle().content || '').replace(new RegExp('"', 'g'), '').replace(new RegExp('\'', 'g'), '');
  },
  /**
   * returns the computed style of the view
   *
   * @returns {object} style
   */
  computedStyle: function() {
    return window.getComputedStyle(this.outerEl, null);
  },
  /**
   * returns the value for the css content property
   *
   * @returns {string} css content value
   */
  grid: function(gridName) {
    gridName = gridName || this.gridName();
    var grid = {
      columns: '*',
      rows: '*',
      direction: 'vertical'
    };

    var attributeValue = (this.getAttributeLJ('grid-' + gridName) || '*,*').split(',');

    if (attributeValue.length > 0 && '*' !== attributeValue[0]) {
      grid.columns = parseInt(attributeValue[0]);
    }

    if (attributeValue.length > 1 && '*' !== attributeValue[1]) {
      grid.rows = parseInt(attributeValue[1]);
    }

    if (attributeValue.length > 2 && '' !== attributeValue[2]) {
      grid.direction = attributeValue[2].toLowerCase();
    }

    return grid;
  },
  /**
   * returns the grid name
   *
   * @returns {string} the grid name
   */
  gridName: function() {
    return this.cssContent();
  },
  /**
  Save the original width of the outer element
  */
  setOriginalWidth: function() {
    this.originalWidth = this.outerEl.style.width;
  },
  /**
  Gets the original width of the outer element
  @return {string}
  */
  getOriginalWidth: function() {
    return this.originalWidth || '';
  },
  /**
  Save the original height of the outer element
  */
  setOriginalHeight: function() {
    this.originalHeight = this.outerEl.style.height;
  },
  /**
  Gets the original height of the outer element
  @return {string}
  */
  getOriginalHeight: function() {
    return this.originalHeight || '';
  }


});

module.exports = BaseView;
