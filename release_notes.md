# Release notes #

## New in 0.4.4
 * The layer now has a transition queue. Events and transition are now getting queued. This gets a more defined behavior if gestures/trigger overlap. The queue is freed after the "transitionPrepared" event is triggered.
 * Refactoring showFrame and scrollTo methods of a layer. Both now use the transitionTo method for showing frames and scrolling. This also puts them into the queue
 * Filerouter is disabled by default. To enable add `lj-router="filerouter"` to the body of the HTML document.
 * Fixes for swipping left/right caused by the history button on chrome Mac. (fix of 0.4.3 fix)
 * Fixed the detection of innerscrolling (scrollable containers within a frame). (fix of 0.4.3 fix)
 * A `lj-nolink` attribute can be added to anchor tags. When true the links will be ignored by the router(s).

## New in 0.4.3
* fix scrolling on IOS devices. Basically native scrolling for divs wasn't working. Also inertial scrolling was not working.

## New in 0.4.2
* Refactored how layerJS keeps track of it's internal state.
* The page url gets calculated when the state of the page changes. Default frames will not be shown in the url.
* Added a public method "navigate" on the router that can be used to navigate.
* Refactored the caching mechanism on the FileRouter.
* The "stateChanged" event will only be triggered when there is a difference between the previous and current state and also when all layers have started the transition.
* Showing multiple frames at once is done synchronized.
* Fixed a bug that removed the hash part of the url when the page reloaded.
* Will scroll smoothly to an anchor tag.
* inertia (kinetic) scrolling on nested elements now works in IOS
* optimized scrolling for nested layers
* On startup the frames are just getting showed instead of transitioned.
* UrlData has been removed.
* The width and height of a frame now includes the margin.

## New in 0.4.1
* allow specifying the default transition type on the frame or layer (HTML attribute lj-transition).
* allow specifying the reverse transition by prepending "r:" to the transition type
* refactored slide transition code. Now a transition is composed of an "in" and an "out" part. This makes it easy to calculate the reverse transitions. Make code more compact.
* synchronized multi frame transitions. if two frames (in two layers) were transitioning in parallel, there could be out of sync if one frame was already present while the other still had to be loaded.
* new event "transitionPrepared" which is triggered right before the actual animation starts
* new lj-startPosition options (top-left, top-right, top-center, middle-left, etc.) for initial positioning of frame in stage
* fixed a bug where the router could trigger click handlers twice on links
* fixed issue in transition To where the transition end wasn't detected if the transition was triggered twice (through double click on link)
* fixed an issue in Firefox where touch pad swipe gestures where not reliably detected.
* fixed elastic fitting
* allow using lj-layout (instead of lj-layout-type) for setting layer layout
* fixed a bug that scrolled to top if '#'-link was clicked
* moved ./dist/css/layerjs.css -> ./dist/layerjs.css
* remove some old unnecessary code

## New in 0.4
* The framework has been simplified. Only the stage, layer and frame views are left.
* A new system has been put into place to detect modifications on the actual DOM element (attribute changes, new children) and on it's size. When modifications are detected an event is triggered.
* Added new events on the views
    * sizeChanged
    * attributesChanged
    * renderRequired
* When no `lj-name` attribute is specified, an unique name gets generated.
* The npm scripts now work on both Windows and Unix like systems.
* The mouse drag has been disabled.
* When transitioning to the same frame, the frame will move up (or down depending on the transition parameters) using an animation. This works in both native and non-native scrolling.
* The `transitionTo()` method of the layerView now also accepts a specific startPosition or scroll positions (scrollX & scrollY).
* A `scrollTo()` method  has been added to the layerView. This method can be used to manipulate the scrolling of the current frame. It accepts a specific startPosition or scroll positions (scrollX & scrollY).
* The fileRouter now has a cache. It will only do an HTMLHttpRequest for pages that haven't been loaded (cached) yet.

## New in 0.3
* A router module has been added to handled link clicks.
 * Static routes can be registered in the router module.
 * a Filerouter will handled links that will point to an external (layerJS) document.
 * a Hashrouter will handle links that contain a hash (#).
* Transition parameters can be passed in as parameters in a link.
* A State object has been added to keep track of the current state of the HTML document. The state describes which frame is active in which layer (and stage).
* A layerView can now switch layout at runtime using the `switchLayout()` method.
* A layerView can now switch between native scrolling and transform scrolling in runtime  using the `switchScrolling()` method.
* The WL namespace has been renamed to layerJS and attributes are now prefixed with `data-lj-*` instead of `data-wl-*`.
* `lj-*` attributes are also accepted
* A fade transition has been added to the slidelayout
* A layerView can now transitionTo/show a `null` frame. In the browser this will be shown as an empty frame.
* A layerView will now expose beforeTransition, transitionStarted and transitionFinished events when a transition is invoked.
* The framework will detect size changes and will adapt the current frames.
* ObjData, GroupData, FrameData, LayerData and StageData have been removed and replaced with a NodeData object.
* View objects now have a static property that will provide default data that can be used to create a NodeData objects.
* View objects now have a static method that can be used to detect if an HTML-tag is of a specific View.
