'use strict';
var $ = require('./domhelpers.js');
var Kern = require('../kern/Kern.js');
var pluginManager = require('./pluginmanager.js');
var layoutManager = require('./layoutmanager.js');
var ScrollTransformer = require('./scrolltransformer.js');
var gestureManager = require('./gestures/gesturemanager.js');
var defaults = require('./defaults.js');
var BaseView = require('./baseview.js');

/**
 * A View which can have child views
 * @param {LayerData} dataModel
 * @param {object}        options
 * @extends GroupView
 */

var LayerView = BaseView.extend({
  constructor: function(options) {
    options = options || {};
    options.childType = 'frame';

    this.innerEl = this.outerEl = options.el;

    if (this.outerEl.children.length === 1 && $.getAttributeLJ(this.outerEl.children[0], 'helper') === 'scroller') {
      this.innerEl = this.outerEl.children[0];
    }

    BaseView.call(this, options);

    this._inPreparation = false; // indicates that the transition is in preparation
    this._inTransition = false; // indicates that transition is still being animated
    this._transitionIDcounter = 1; // counts up every call of transitionTo()
    this.transitionID = 1; // in principle the same as _transitionIDcounter, but may be reset is transitionTo is not actually executing a transition
    this.scrollID = 1; // counts up every solitary scrollTo call (if duration>0);
    this.currentFrame = null;

    this.switchLayout(this.layoutType());
    this.switchScrolling(this.nativeScroll());

    // get upper layer where unuseable gestures should be sent to.
    // this.parentLayer = this.getParentOfType('layer');
    // register for gestures
    gestureManager.register(this.outerEl, this.gestureListener.bind(this), {
      dragging: true,
      mouseDragging: false
    });

    var that = this;

    this.onResizeCallBack = function() {
      // when doing a transform, the callback should not be called
      if (!that.inTransition()) {
        that.onResize();
      }
    };

    // this is my stage and add listener to keep it updated
    this.stage = this.parent;

    /*    if (this.stage) {
          sizeObserver.register([this.stage], this.onResizeCallBack);
        }
    */
    /*  this.on('parent', function() {
      sizeObserver.unregister([that.stage]);
      that.stage = that.parent;
      sizeObserver.register([that.stage], that.onResizeCallBack);
      // FIXME trigger adaption to new stage
    });
*/
    // listen to scroll events
    this.on('scroll', function() { // jshint ignore:line
      //that._layout.updateTransitions(); // FIXME: notify layout about scroll and that prepared transitions may be outdated
    });
    /*
    // register for gestures
    gestureManager.register(this.layer.outerEl,function(){
      that.gestureListener.apply(that,arguments);
    })
    */

    if (this.defaultFrame()) {
      this.currentFrame = this._getFrame(this.defaultFrame());
    } else {
      this.currentFrame = this._getFrame(defaults.specialFrames.next);
    }

    // set the initial frame if possible
    if (!this.currentFrame || null === this.currentFrame) {
      this.showFrame(defaults.specialFrames.none);
    } else {
      this.showFrame(this.currentFrame.name());
    }
  },
  /**
   * Specifies what will need to be observed on the DOM element. (Attributes, Children and size)
   */
  startObserving: function() {
    BaseView.prototype.observe.call(this, this.innerEl, {
      attributes: true,
      attributeFilter: ['name', 'lj-name', 'id', 'data-lj-native-scroll', 'data-lj-no-scrolling', 'lj-layout-type', 'lj-native-scroll', 'lj-no-scrolling', 'lj-layout-type'],
      children: true
    });
  },
  /**
   * Will add eventhandlers to specific events. It will handle a 'childrenChanged', 'sizeChanged' and
   * 'attributesChanged' event. It will also handle it's parent 'renderRequired' event.
   */
  registerEventHandlers: function() {
    var that = this;
    BaseView.prototype.registerEventHandlers.call(this);

    this.on('attributesChanged', this.attributesChanged);

    if (this.parent) {
      this.parent.on('renderRequired', function() {
        if (!that.inTransition()) {
          that.onResize();
        }
      });
    }
  },
  /**
   * Will be invoked the an 'attributesChanged' event is triggered.
   * @param {Object} attributes - a hash object the contains the changed attributes
   */
  attributesChanged: function(attributes) {

    if (attributes['lj-native-scroll'] || attributes['data-lj-native-scroll'] !== -1) {
      this.switchScrolling(this.nativeScroll());
    }

    if (attributes['lj-layout-type'] !== -1 || attributes['data-lj-layout-type'] !== -1) {
      this.switchLayout(this.layoutType());
    }

  },
  /**
   * Will place a child view at the correct position.
   * @param {Object} childView - the childView
   */
  renderChildPosition: function(childView) {
    // function is called when children are getting parsed. At that point, the layout can still be undefined
    if (!this._layout) {
      this.switchLayout(this.layoutType());
    }

    this._layout.renderFramePosition(childView, this._currentTransform);
  },
  /**
   * This method is called if a transition is started. It has a timeout function that will automatically remove
   * the _inTransition flag because DOM's transitionend is unreliable and this may block the whole swiping mechanism
   *
   * @param {number} duration - specify the expected length of the transition.
   * @returns {boolean} inTranstion or not
   */
  inTransition: function(_inTransition, duration) {
    if (_inTransition) {
      var that = this;
      this._inTransitionTimestamp = Date.now();
      var tID = this.transitionID;
      this._inTransitionDuration = duration;
      this._intransitionID = tID;
      this._inTransition = true;
      setTimeout(function() {
        if (tID === that.transitionID) {
          delete that._inTransitionTimestamp;
          delete that._inTransitionDuration;
          delete that._intransitionID;
          that._inTransition = false;
        }
      }, duration);
    } else if (_inTransition === false && this.transitionID === this._intransitionID) {
      delete this._inTransitionTimestamp;
      delete this._inTransitionDuration;
      delete this._intransitionID;
      this._inTransition = false;
    }
    return this._inTransition;
  },
  /**
   * This method is called if the preparation is started or ended.  It has a timeout function that will automatically remove
   * the _inPreparation flag
   *
   * @returns {boolean} inPreparation or not
   */
  inPreparation: function(_inPreparation, duration) {
    if (_inPreparation !== undefined) {
      this._inPreparation = _inPreparation;

      if (_inPreparation) {
        var that = this;
        var tID = this.transitionID;
        setTimeout(function() {
          if (tID === that.transitionID) {
            that._inPreparation = false;
          }
        }, duration);
      }
    }
    return this._inPreparation;
  },
  /**
   * returns the number of milliseconds left on the current transition or false if no transition is currently on going
   *
   * @returns {number/boolean} duration left in ms or false
   */
  getRemainingTransitionTime: function() {
    if (this._inTransition) {
      return Math.max(0, this._inTransitionDuration - (Date.now() - this._inTransitionTimestamp));
    } else {
      return false;
    }
  },
  /**
   * Will toggle native and non-native scrolling
   *
   * @param {boolean} nativeScrolling
   * @returns {void}
   */
  switchScrolling: function(nativeScrolling) {
    this.unobserve();
    var hasScroller = this.outerEl.children.length === 1 && $.getAttributeLJ(this.outerEl.children[0], 'helper') === 'scroller';

    if (nativeScrolling) {
      this.innerEl = hasScroller ? this.outerEl.children[0] : $.wrapChildren(this.outerEl);
      $.setAttributeLJ(this.innerEl, 'helper', 'scroller');
      if (!this.innerEl._ljView) {
        this.innerEl._ljView = this.outerEl._ljView;
        this.innerEl._state = this.outerEl._state;
      }
      this.outerEl.className += ' nativescroll';
    } else {
      if (hasScroller) {
        $.unwrapChildren(this.outerEl);
      }
      this.innerEl = this.outerEl;
      this.outerEl.className = this.outerEl.className.replace(' nativescroll', '');
    }

    this._transformer = this._layout.getScrollTransformer() || new ScrollTransformer(this);
    this.setNativeScroll(nativeScrolling);

    if (this.currentFrame) {
      this.showFrame(this.currentFrame.name(), this.currentFrame.getScrollData());
    }

    this.startObserving();
  },
  /**
   * returns the current scrollX and scrollY
   *
   * @returns {Object} {scrollX: scrollX scrollY: scrollY}
   */
  getCurrentScroll: function() {
    return {
      scrollX: this.currentFrameTransformData.scrollX,
      scrollY: this.currentFrameTransformData.scrollY
    };
  },
  /**
   * scrolls to a specified x,y position or a predefined postions using startPosition
   *
   * @param {Number} scrollX - optional: the new scroll x position
   * @param {Number} scrollY - optional: the new scroll y position
   * @param {object} transition - optional: includes duration: and optional scrollX, scrollY or startPosition
   * @returns {Promise} a promise that resolves when transition is finished
   */
  scrollTo: function(scrollX, scrollY, transition) {
    if (this.currentFrame === null) return;
    transition = transition || {};
    if (transition.startPosition) { // need to recalculate transform data if startPosition has changed
      this.currentFrameTransformData = this.currentFrame.getTransformData(this.stage, transition.startPosition);
    }
    var tfd = this.currentFrameTransformData;
    if (typeof scrollX === 'object') {
      transition = scrollX;
      scrollX = 0;
    }
    scrollX = (scrollX !== undefined ? scrollX : (transition.scrollX !== undefined ? transition.scrollX : tfd.scrollX || 0));
    scrollY = (scrollY !== undefined ? scrollY : (transition.scrollY !== undefined ? transition.scrollY : tfd.scrollY || 0));
    this.currentTransform = this._transformer.getScrollTransform(tfd, scrollX, scrollY, true);
    var d = transition && transition.duration && $.timeToMS(transition.duration);
    if (this.inTransition()) { // make scroll transition time at least as long as ongoing transition;
      d = Math.max(this.getRemainingTransitionTime(), d || 0);
    }
    var myScrollID;
    if (d) { // we have a transition time (duration)
      this.inTransition(true, d);
      myScrollID = ++this.scrollID;
      var that = this;
      return this.setLayerTransform(this.currentTransform, {
        transition: d + "ms"
      }).then(function() {
        if (that.scrollID !== myScrollID) return; // there was another scrollTo in between so don't finish.
        that.currentTransform = that._transformer.getScrollTransform(tfd, scrollX, scrollY, false);
        // apply new transform (will be 0,0 in case of native scrolling)
        that.inTransition(false);
        that.setLayerTransform(that.currentTransform);

      });
    } else {
      return this.setLayerTransform(this.currentTransform);
    }
  },
  /**
   * Will change the current layout with an other layout
   *
   * @param {string} layoutType - the name of the layout type
   * @returns {void}
   */
  switchLayout: function(layoutType) {
    this._layout = new(layoutManager.get(layoutType))(this);
    this._transformer = this._layout.getScrollTransformer() || new ScrollTransformer(this);

    if (this.currentFrame) {
      this.showFrame(this.currentFrame.name());
    }
  },
  /**
   * set the scroll transform for the layer using the layouts setLayerTransform method. will check for the correct transition times if a transition is currently ongoing. CAVEAT: currently only support a plain transition property with only a time value e.g. setLayerTransform("translate(...)", {transition: "2s"})
   *
   * @param {string} transform - the transform for the scrolling
   * @param {Object} css - set the transitions property here
   * @returns {Promise} fullfilled after trnaisiton ends
   */
  setLayerTransform: function(transform, cssTransition) {
    var d = 0;
    if (cssTransition && cssTransition.transition) {
      d = $.timeToMS(cssTransition.transition); // FIXME there could be other values in transition and the duration may be set through transition-duration
    }
    d = this.inTransition() ? Math.max(this.getRemainingTransitionTime(), d) : d; // duration should be at least as long as currently ongoing transition;
    d = d ? d + "ms" : ''; // make ms time or empty string
    return this._layout.setLayerTransform(transform, {
      transition: d
    });
  },
  gestureListener: function(gesture) {
    if (this.currentFrame === null) { //this actually shoudn't happen as null frames don't have a DOM element that could recieve a gesture. However it happens when the gesture still continues from before the transition. Still we can't do anything here as we can't define neighbors for null frames (maybe later)
      return;
    }
    var layerTransform = this._transformer.scrollGestureListener(gesture);

    if (gesture.first) {
      return;
    }
    if (layerTransform === true) {
      // native scrolling possible
      return;
    } else if (layerTransform) {
      this.setLayerTransform(this.currentTransform = layerTransform);
      gesture.preventDefault = true;
    } else {
      if (this.inTransition()) gesture.preventDefault = true; // we need to differentiate here later as we may have to check up stream handlers
      // gesture.cancelled = true;
      var neighbors = this.currentFrame.neighbors();
      if (gesture.direction) {
        if (neighbors && neighbors[defaults.directions2neighbors[gesture.direction]]) {
          gesture.preventDefault = true;
          if (!this.inTransition() && (gesture.last || (gesture.wheel && gesture.enoughDistance()))) {
            this.transitionTo(neighbors[defaults.directions2neighbors[gesture.direction]], {
              type: defaults.neighbors2transition[defaults.directions2neighbors[gesture.direction]]
            });
          }
        } else { //jshint ignore:line
          // FIXME: escalate/gesture bubbling ; ignore for now
        }
      } else { //jshint ignore:line
        // this will prevent any bubbling for small movements
        gesture.preventDefault = true;
      }
    }
  },
  /**
   * show current frame immidiately without transition/animation
   *
   * @param {string} framename - the frame to be active
   * @param {Object} scrollData - information about the scroll position to be set. Note: this is a subset of a
   * transition object where only startPosition, scrollX and scrollY is considered
   * @returns {void}
   */
  showFrame: function(framename, scrollData) {
    if (!this.stage) {
      return;
    }
    scrollData = scrollData || {};
    var that = this;
    var frame = null;


    frame = framename ? this._getFrame(framename) : null;
    if (!frame && null !== frame) throw "transformTo: " + framename + " does not exist in layer";

    if (null !== frame) {
      framename = frame.name();
    }

    that.trigger('beforeTransition', framename);

    // this.inTransition(true, 0);
    this.inPreparation(true);
    this._layout.loadFrame(frame).then(function() {
      var tfd = that.currentFrameTransformData = null === frame ? that.noFrameTransformdata(scrollData.startPosition) : frame.getTransformData(that.stage, scrollData.startPosition);
      that.currentTransform = that._transformer.getScrollTransform(tfd, scrollData.scrollX || (tfd.isScrollX && tfd.scrollX) || 0, scrollData.scrollY || (tfd.isScrollY && tfd.scrollY) || 0);
      that.currentFrame = frame;

      that.trigger('transitionStarted', framename);
      that._layout.showFrame(frame, tfd, that.currentTransform);
      that.inPreparation(false);
      that.inTransition(false); // we stop all transitions if we do a showframe
      that.currentFrame = frame;
      that.trigger('transitionFinished', framename);
    });
  },
  noFrameTransformdata: function(transitionStartPosition) {
    var d = {};
    d.stage = this.stage;
    d.scale = 1;
    d.width = d.frameWidth = this.stage.width();
    d.height = d.frameHeight = this.stage.height();
    d.shiftX = d.shiftY = d.scrollX = d.scrollY = 0;
    d.isScrollX = d.isScrollY = false;
    d.startPosition = transitionStartPosition || 'top';
    d.initialScrollX = d.scrollX;
    d.initialScrollY = d.scrollY;

    return d;
  },
  /**
   * transform to a given frame in this layer with given transition
   *
   * @param {string} [framename] - (optional) frame name to transition to
   * @param {Object} [transition] - (optional) transition object
   * @returns {Kern.Promise} a promise fullfilled after the transition finished. Note: if you start another transition before the first one finished, this promise will not be resolved.
   */
  transitionTo: function(framename, transition) {
    // is framename  omitted?
    if (typeof framename === 'object' && null !== framename) {
      transition = framename;
      framename = transition.framename;
    } else if (null !== framename) {
      framename = framename || (transition && transition.framename);
    }
    if (!framename && null !== framename) throw "transformTo: no frame given";
    // lookup frame by framename
    var frame = framename ? this._getFrame(framename, transition) : null;

    if (!frame && null !== frame) throw "transformTo: " + framename + " does not exist in layer";
    var that = this;

    if (frame && null !== frame) {
      framename = frame.name();
    }
    // dealing with transition.type

    // autotransitions are transition types automatically generated e.g. by swipe gestures. They are "suggested" and hence have to be dealt with lower priority
    var autotransition;
    if (transition && transition.type && transition.type.match(/^auto:/)) {
      autotransition = transition.type.replace(/^auto:/, '');
      delete transition.type; // needs to be removed for now; othervise if will overwrite default transitions which is not desired for auto transitions
    }
    // merge defaults with given transition records; transition.type will overwrite default transitions (unless auto transition)
    transition = Kern._extend({
      type: transition && transition.type ? 'default' : (frame && frame.defaultTransition()) || this.defaultTransition() || autotransition || 'default',
      previousType: transition && transition.type ? undefined : (this.currentFrame && this.currentFrame.defaultTransition()) || undefined,
      duration: '1s'
      // FIXME: add more default values like timing
    }, transition || {});
    // check for reverse transition; remove "r:"/"reverse:" indicator and set transition.reverse instead
    if (transition.type && transition.type.match(/^(?:r:|reverse:)/i)) {
      transition.type = transition.type.replace(/^(?:r:|reverse:)/i, '');
      transition.reverse = true;
    }
    if (transition.previousType && transition.previousType.match(/^(?:r:|reverse:)/i)) {
      transition.previousType = transition.previousType.replace(/^(?:r:|reverse:)/i, '');
      transition.previousReverse = true;
    }
    // create a dummy semaphore if there isn't any
    if (!transition.semaphore) {
      transition.semaphore = (new Kern.Semaphore()).register();
    }
    var wasInTransition = this.inTransition();
    that.trigger('beforeTransition', framename);
    transition.transitionID = this.transitionID = ++this._transitionIDcounter; // inc transition ID and save new ID into transition record
    this.inPreparation(true, $.timeToMS(transition.duration));
    this.inTransition(true, $.timeToMS(transition.duration));

    if (that.currentFrame === frame && wasInTransition) {
      // this is not a valid transition -> so the transitionend handlers of the previous transition must be called (if in transition currently)
      this.transitionID--; // note: this will not update _inTransitionIDcounter, so the next transition will not conflict with this invalid transition in the inTransition() setTimeout handlers.
    }

    // make sure frame is there such that we can calculate dimensions and transform data
    return this._layout.loadFrame(frame).then(function() {
      that.inPreparation(false);
      // calculate the layer transform for the target frame. Note: this will automatically consider native scrolling
      // getScrollIntermediateTransform will not change the current native scroll position but will calculate
      // a compensatory transform for the target scroll position.
      var currentScroll = that.getCurrentScroll(); // get current scroll position before recalculating it for this frame
      var targetFrameTransformData = null === frame ? that.noFrameTransformdata(transition.startPosition) : frame.getTransformData(that.stage, transition.startPosition);
      var targetTransform = that._transformer.getScrollTransform(targetFrameTransformData, transition.scrollX || targetFrameTransformData.scrollX, transition.scrollY || targetFrameTransformData.scrollY, true);
      // check if transition goes to exactly the same position
      if (that.currentFrame === frame && that.currentFrameTransformData === targetFrameTransformData) {
        // don't do a transition, just execute Promise
        var p = new Kern.Promise();
        that.trigger('transitionStarted', framename);
        transition.semaphore.sync().then(function() { // we need to call sync in case there are other transitions waiting.
          if (targetFrameTransformData.scrollX !== currentScroll.scrollX || targetFrameTransformData.scrollY !== currentScroll.scrollY) {
            return that.scrollTo(targetFrameTransformData.scrollX, targetFrameTransformData.scrollY, transition).then(function() {
              if (!wasInTransition) {
                that.trigger('transitionFinished', framename);
                that.inTransition(false);
              }
            });
          } else {
            if (!wasInTransition) {
              that.trigger('transitionFinished', framename);
              that.inTransition(false);
            }
            p.resolve();
          }
        });
        return p;
      }


      var layoutPromise = that._layout.transitionTo(frame, transition, targetFrameTransformData, targetTransform).then(function() {
        // is this still the active transition?
        if (transition.transitionID === that.transitionID) {
          // this will now calculate the currect layer transform and set up scroll positions in native scroll
          that.currentTransform = that._transformer.getScrollTransform(targetFrameTransformData, transition.scrollX || targetFrameTransformData.initialScrollX, transition.scrollY || targetFrameTransformData.initialScrollY, false);
          // apply new transform (will be 0,0 in case of native scrolling)
          that.inTransition(false);
          that.setLayerTransform(that.currentTransform);
          $.postAnimationFrame(function() {
            that.trigger('transitionFinished', framename);
          });
        }
      });

      that.updateClasses(frame);
      that.currentFrameTransformData = targetFrameTransformData;
      that.currentFrame = frame;
      that.currentTransform = targetTransform;
      that.trigger('transitionStarted', framename);

      return layoutPromise;
    });
  },
  /**
   * Will get a frame based on the framename. Special names will be resolved.
   *
   * @param {string} [framename] - frame name
   * @param {Object} [transition] - (optional) transition object
   * @returns {Object} a frame
   */
  _getFrame: function(frameName, transition) {
    if (frameName === defaults.specialFrames.left || frameName === defaults.specialFrames.right || frameName === defaults.specialFrames.top || frameName === defaults.specialFrames.bottom) {

      if (null !== this.currentFrame) {
        var neighbors = this.currentFrame.neighbors();
        transition = transition || {};

        if (neighbors && neighbors.l && frameName === defaults.specialFrames.left) {
          frameName = neighbors.l;
        } else if (neighbors && neighbors.r && frameName === defaults.specialFrames.right) {
          frameName = neighbors.r;
        } else if (neighbors && neighbors.t && frameName === defaults.specialFrames.top) {
          frameName = neighbors.t;
        } else if (neighbors && neighbors.b && frameName === defaults.specialFrames.bottom) {
          frameName = neighbors.b;
        } else if (transition.type === defaults.neighbors2transition.r && frameName === defaults.specialFrames.left && ((neighbors && !neighbors.l) || !neighbors)) {
          frameName = defaults.specialFrames.next;
        } else if (transition.type === defaults.neighbors2transition.l && frameName === defaults.specialFrames.right && ((neighbors && !neighbors.r) || !neighbors)) {
          frameName = defaults.specialFrames.previous;
        } else if (transition.type === defaults.neighbors2transition.b && frameName === defaults.specialFrames.bottom && ((neighbors && !neighbors.u) || !neighbors)) {
          frameName = defaults.specialFrames.previous;
        } else if (transition.type === defaults.neighbors2transition.u && frameName === defaults.specialFrames.top && ((neighbors && !neighbors.b) || !neighbors)) {
          frameName = defaults.specialFrames.next;
        } else if (!neighbors) {
          frameName = defaults.specialFrames.next;
        }
      } else if (null === this.currentFrame) {
        if (frameName !== defaults.specialFrames.previous) {
          frameName = defaults.specialFrames.next;
        } else if (frameName !== defaults.specialFrames.next) {
          frameName = defaults.specialFrames.previous;
        }
      }
    }

    if (frameName === defaults.specialFrames.next) {
      frameName = this._getNextFrameName();
    } else if (frameName === defaults.specialFrames.previous) {
      frameName = this._getPreviousFrameName();
    }

    return frameName === defaults.specialFrames.none ? null : this.getChildViewByName(frameName);
  },
  /**
   * Will get the next framename based on the html order
   *
   * @returns {string} a framename
   */
  _getNextFrameName: function() {
    var frameName;
    var childViews = this.getChildViews();

    if (null === this.currentFrame && childViews.length > 0) {
      frameName = childViews[0].name();
    } else if (null !== this.currentFrame && childViews.length > 0) {
      var index = 0;
      for (; index < childViews.length; index++) {
        if (this.currentFrame.name() === childViews[index].name()) {
          break;
        }
      }
      if (index + 1 < childViews.length) {
        frameName = childViews[index + 1].name();
      } else {
        frameName = childViews[0].name();
      }
    }

    return frameName;
  },
  /**
   * Will get the previous framename based on the html order
   *
   * @returns {string} a framename
   */
  _getPreviousFrameName: function() {
    var frameName;
    var childViews = this.getChildViews();

    if (null === this.currentFrame && childViews.length > 0) {
      frameName = childViews[0].name();
    } else if (null !== this.currentFrame && childViews.length > 0) {
      var index = childViews.length - 1;
      for (; index >= 0; index--) {
        if (this.currentFrame.name() === childViews[index].name()) {
          break;
        }
      }
      if (index === 0) {
        frameName = childViews[childViews.length - 1].name();
      } else if (index > 0) {
        frameName = childViews[index - 1].name();
      }
    }

    return frameName;
  },
  getCurrentTransform: function() {
    return this.currentTransform;
  },
  /**
   * updates HTML classes for frames during transition or showFrame
   *
   * @param {Type} Name - Description
   * @returns {Type} Description
   */
  updateClasses: function(newFrame) {
    if (this.currentFrame) {
      this._saveLastFrame = this.currentFrame;
      this.currentFrame.outerEl.className = this.currentFrame.outerEl.className.replace(/\s*wl\-active\s*/g, '');
    }
    if (null !== newFrame) {
      newFrame.outerEl.className += " wl-active";
    }
  },
  /**
   * render child positions. overriden default behavior of groupview
   *
   * @param {ElementView} childView - the child view that has changed
   * @returns {Type} Description
   */
  _renderChildPosition: function(childView) {
    if (!this._layout) {
      this.switchLayout(this.layoutType());
    }

    childView.unobserve();
    this._layout.renderFramePosition(childView, this.currentTransform);
    childView.startObserving();
  },
  /**
   * Method will be invoked when a resize event is detected.
   */
  onResize: function() {
    var childViews = this.getChildViews();
    var length = childViews.length;
    var scrollData = this.currentFrame !== null ? this.currentFrame.getScrollData() : undefined;

    for (var i = 0; i < length; i++) {
      var childView = childViews[i];
      if (childView.hasOwnProperty('transformData')) {
        childView.transformData = undefined;
      }
    }
    var frameName = this.currentFrame === null ? null : this.currentFrame.name();
    this.showFrame(frameName, scrollData);
  },
  /**
   * Will parse the current DOM Element it's children.
   * @param {object} options - optional: includes addedNodes
   */
  _parseChildren: function(options) {

    BaseView.prototype._parseChildren.call(this, options);

    var childrenViews = this._cache.children;

    if (options && options.addedNodes && options.addedNodes.length > 0) {
      childrenViews = [];
      for (var i = 0; i < options.addedNodes.length; i++) {
        if (options.addedNodes[i]._ljView) {
          childrenViews.push(options.addedNodes[i]._ljView);
        }
      }
    }

    var that = this;
    var renderRequiredEventHandler = function(name) {
      if (!that.inTransition() && that.currentFrame && null !== that.currentFrame && that.currentFrame.name() === name) {
        that._renderChildPosition(that._cache.childNames[name]);
        that.onResize();
      }
    };

    for (var y = 0; y < childrenViews.length; y++) {
      childrenViews[y].on('renderRequired', renderRequiredEventHandler);
    }
  }
}, {
  defaultProperties: {
    type: 'layer'
  },
  identify: function(element) {
    var type = $.getAttributeLJ(element, 'type');
    return null !== type && type.toLowerCase() === LayerView.defaultProperties.type;
  }
});

pluginManager.registerType('layer', LayerView, defaults.identifyPriority.normal);

module.exports = LayerView;
