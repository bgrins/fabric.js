(function(){
  
  var global = this,
      fabric = global.fabric || (global.fabric = { }),
      extend = fabric.util.object.extend,
      clone = fabric.util.object.clone,
      toFixed = fabric.util.toFixed,
      capitalize = fabric.util.string.capitalize,
      getPointer = fabric.util.getPointer,
      slice = Array.prototype.slice
      
  if (fabric.Object) {
    return;
  }
  
  /** 
   * @class Object
   * @memberOf fabric
   */
  fabric.Object = fabric.util.createClass(/** @scope fabric.Object.prototype */ {
    
    /**
     * @property
     * @type String
     */
    type: 'object',
    
    /**
     * @property
     * @type Boolean
     */
    includeDefaultValues: true,
    
    /**
     * @constant
     * @type Number
     */
    NUM_FRACTION_DIGITS:        2,
    
    /**
     * @constant
     * @type Number
     */
    FX_DURATION:                500,
    
    /**
     * @constant
     * @type String
     */
    FX_TRANSITION:              'decel',
    
    /**
     * @constant
     * @type Number
     */
    MIN_SCALE_LIMIT:            0.1,
    
    /**
     * List of properties to consider when checking if state of an object is changed (fabric.Object#hasStateChanged); 
     * as well as for history (undo/redo) purposes
     * @property
     * @type Array
     */
    stateProperties:  ('top left width height scaleX scaleY flipX flipY ' +
                      'theta angle opacity cornersize fill overlayFill stroke ' +
                      'strokeWidth fillRule borderScaleFactor transformMatrix').split(' '),
    
    // TODO (kangax): rename to `defaultOptions`
    
    /**
     * @property
     * @type Object
     */
    options: {
      top:                      0,
      left:                     0,
      width:                    100,
      height:                   100,
      scaleX:                   1,
      scaleY:                   1,
      flipX:                    false,
      flipY:                    false,
      theta:                    0,
      opacity:                  1,
      angle:                    0,
      cornersize:               10,
      padding:                  0,
      borderColor:              'rgba(102,153,255,0.75)',
      cornerColor:              'rgba(102,153,255,0.5)',
      fill:                     'rgb(0,0,0)',
      overlayFill:              null,
      stroke:                   null,
      strokeWidth:              1,
      fillRule:                 'source-over',
      borderOpacityWhenMoving:  0.4,
      borderScaleFactor:        1,
      transformMatrix:          null
    },
    
    /**
     * @method callSuper
     * @param {String} methodName
     */
    callSuper: function(methodName) {
      var fn = this.constructor.superclass.prototype[methodName];
      return (arguments.length > 1) 
        ? fn.apply(this, slice.call(arguments, 1))
        : fn.call(this);
    },
    
    /**
     * Constructor
     * @method initialize
     * @param {Object} [options] Options object
     */
    initialize: function(options) {
      // overwrite default options with specified ones
      this.setOptions(options);
      // "import" state properties into an instance
      this._importProperties();
      // create "local" members
      this.originalState = { };
      // set initial coords
      this.setCoords();
      // setup state properties
      this.saveState();
    },
    
    /**
     * @method setOptions
     * @param {Object} [options]
     */
    setOptions: function(options) {
      // this.constructor.superclass.prototype.options -> this.options -> options
      this.options = extend(this._getOptions(), options);
    },
    
    /**
     * @private
     * @method _getOptions
     */
    _getOptions: function() {
      return extend(clone(this._getSuperOptions()), this.options);
    },
    
    /**
     * @private
     * @method _getSuperOptions
     */
    _getSuperOptions: function() {
      var c = this.constructor;
      if (c) {
        var s = c.superclass;
        if (s) {
          var p = s.prototype;
          if (p && typeof p._getOptions == 'function') {
            return p._getOptions();
          }
        }
      }
      return { };
    },
    
    /**
     * @private
     * @method _importProperties
     */
    _importProperties: function() {
      this.stateProperties.forEach(function(prop) {
        (prop === 'angle') 
          ? this.setAngle(this.options[prop])
          : (this[prop] = this.options[prop]);
      }, this);
    },
    
    /**
     * @method transform
     * @param {CanvasRenderingContext2D} ctx Context
     */
    transform: function(ctx) {
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.left, this.top);
      ctx.rotate(this.theta);
      ctx.scale(
        this.scaleX * (this.flipX ? -1 : 1), 
        this.scaleY * (this.flipY ? -1 : 1)
      );
    },
    
    /**
     * Returns an object representation of an instance
     * @method toObject
     * @return {Object}
     */
    toObject: function() {
      var object = {
        type: this.type,
        left: toFixed(this.left, this.NUM_FRACTION_DIGITS),
        top: toFixed(this.top, this.NUM_FRACTION_DIGITS),
        width: toFixed(this.width, this.NUM_FRACTION_DIGITS),
        height: toFixed(this.height, this.NUM_FRACTION_DIGITS),
        fill: this.fill,
        overlayFill: this.overlayFill,
        stroke: this.stroke,
        strokeWidth: this.strokeWidth,
        scaleX: toFixed(this.scaleX, this.NUM_FRACTION_DIGITS),
        scaleY: toFixed(this.scaleY, this.NUM_FRACTION_DIGITS),
        angle: toFixed(this.getAngle(), this.NUM_FRACTION_DIGITS),
        flipX: this.flipX,
        flipY: this.flipY,
        opacity: toFixed(this.opacity, this.NUM_FRACTION_DIGITS)
      };
      
      if (!this.includeDefaultValues) {
        object = this._removeDefaultValues(object);
      }
      return object;
    },
    
    /**
     * Returns (dataless) object representation of an instance
     * @method toDatalessObject
     */
    toDatalessObject: function() {
      // will be overwritten by subclasses
      return this.toObject();
    },
    
    /**
     * @private
     * @method _removeDefaultValues
     */
    _removeDefaultValues: function(object) {
      var defaultOptions = fabric.Object.prototype.options;
      this.stateProperties.forEach(function(prop) {
        if (object[prop] === defaultOptions[prop]) {
          delete object[prop];
        }
      });
      return object;
    },
    
    /**
     * Returns true if an object is in its active state
     * @return {Boolean} true if an object is in its active state
     */
    isActive: function() {
      return !!this.active;
    },
    
    /**
     * Sets state of an object - `true` makes it active, `false` - inactive
     * @param {Boolean} active
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setActive: function(active) {
      this.active = !!active;
      return this;
    },
    
    /**
     * Returns a string representation of an instance
     * @return {String}
     */
    toString: function() {
      return "#<fabric." + capitalize(this.type) + ">";
    },
    
    /**
     * Basic setter
     * @param {Any} property
     * @param {Any} value
     * @return {fabric.Object} thisArg
     * @chainable
     */
    set: function(property, value) {
      var shouldConstrainValue = (property === 'scaleX' || property === 'scaleY') && value < this.MIN_SCALE_LIMIT;
      if (shouldConstrainValue) {
        value = this.MIN_SCALE_LIMIT;
      }
      if (property === 'angle') {
        this.setAngle(value);
      }
      else {
        this[property] = value;
      }
      return this;
    },
    
    /**
     * Toggles specified property from `true` to `false` or from `false` to `true`
     * @method toggle
     * @param {String} property property to toggle
     * @return {fabric.Object} thisArg
     * @chainable
     */
    toggle: function(property) {
      var value = this.get(property);
      if (typeof value === 'boolean') {
        this.set(property, !value);
      }
      return this;
    },
    
    /**
     * @method setSourcePath
     * @param {String} value
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setSourcePath: function(value) {
      this.sourcePath = value;
      return this;
    },
    
    /**
     * Basic getter
     * @method get
     * @param {Any} property
     * @return {Any} value of a property
     */
    get: function(property) {
      return (property === 'angle') 
        ? this.getAngle() 
        : this[property];
    },
    
    /**
     * @method render
     * @param {CanvasRenderingContext2D} ctx context to render on
     * @param {Boolean} noTransform
     */
    render: function(ctx, noTransform) {
      
      // do not render if width or height are zeros
      if (this.width === 0 || this.height === 0) return;
      
      ctx.save();
      
      var m = this.transformMatrix;
      if (m) {
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      }
      
      if (!noTransform) {
        this.transform(ctx);
      }
      
      if (this.stroke) {
        ctx.lineWidth = this.strokeWidth;
        ctx.strokeStyle = this.stroke;
      }
      
      if (this.overlayFill) {
        ctx.fillStyle = this.overlayFill;
      }
      else if (this.fill) {
        ctx.fillStyle = this.fill;
      }
      
      this._render(ctx, noTransform);
      
      if (this.active && !noTransform) {
        this.drawBorders(ctx);
        this.hideCorners || this.drawCorners(ctx);
      }
      ctx.restore();
    },
    
    /**
     * Returns width of an object
     * @method getWidth
     * @return {Number} width value
     */
    getWidth: function() {
      return this.width * this.scaleX;
    },
    
    /**
     * Returns height of an object
     * @method getHeight
     * @return {Number} height value
     */
    getHeight: function() {
      return this.height * this.scaleY;
    },
    
    /**
     * Scales an object (equally by x and y)
     * @method scale
     * @param value {Number} scale factor
     * @return {fabric.Object} thisArg
     * @chainable
     */
    scale: function(value) {
      this.scaleX = value;
      this.scaleY = value;
      return this;
    },
    
    /**
     * Scales an object to a given width (scaling by x/y equally)
     * @method scaleToWidth
     * @param value {Number} new width value
     * @return {fabric.Object} thisArg
     * @chainable
     */
    scaleToWidth: function(value) {
      return this.scale(value / this.width);
    },
    
    /**
     * Scales an object to a given height (scaling by x/y equally)
     * @method scaleToHeight
     * @param value {Number} new height value
     * @return {fabric.Object} thisArg
     * @chainable
     */
    scaleToHeight: function(value) {
      return this.scale(value / this.height);
    },
    
    /**
     * Sets object opacity 
     * @method setOpacity
     * @param value {Number} value 0-1
     * @return {fabric.Object} thisArg
     * @chainable
     */
    setOpacity: function(value) {
      this.set('opacity', value);
      return this;
    },
    
    /**
     * Returns object's angle value
     * @method getAngle
     * @return {Number} angle value
     */
    getAngle: function() {
      return this.theta * 180 / Math.PI;
    },
    
    /**
     * Sets object's angle
     * @method setAngle
     * @param value {Number} angle value
     * @return {Object} thisArg
     */
    setAngle: function(value) {
      this.theta = value / 180 * Math.PI;
      this.angle = value;
      return this;
    },
    
    /**
     * Sets corner position coordinates based on current angle, width and height.
     * @method setCoords
     * return {fabric.Object} thisArg
     * @chainable
     */
    setCoords: function() {
      
      this.currentWidth = this.width * this.scaleX;
      this.currentHeight = this.height * this.scaleY;
      
      this._hypotenuse = Math.sqrt(
        Math.pow(this.currentWidth / 2, 2) + 
        Math.pow(this.currentHeight / 2, 2));
        
      this._angle = Math.atan(this.currentHeight / this.currentWidth);

      // offset added for rotate and scale actions
      var offsetX = Math.cos(this._angle + this.theta) * this._hypotenuse,
          offsetY = Math.sin(this._angle + this.theta) * this._hypotenuse,
          theta = this.theta,
          sinTh = Math.sin(theta),
          cosTh = Math.cos(theta);

      var tl = {
        x: this.left - offsetX,
        y: this.top - offsetY
      };
      var tr = {
        x: tl.x + (this.currentWidth * cosTh),
        y: tl.y + (this.currentWidth * sinTh)
      };
      var br = {
        x: tr.x - (this.currentHeight * sinTh),
        y: tr.y + (this.currentHeight * cosTh)
      };
      var bl = {
        x: tl.x - (this.currentHeight * sinTh),
        y: tl.y + (this.currentHeight * cosTh)
      };
      var ml = {
        x: tl.x - (this.currentHeight/2 * sinTh),
        y: tl.y + (this.currentHeight/2 * cosTh)
      };
      var mt = {
        x: tl.x + (this.currentWidth/2 * cosTh),
        y: tl.y + (this.currentWidth/2 * sinTh)
      };
      var mr = {
        x: tr.x - (this.currentHeight/2 * sinTh),
        y: tr.y + (this.currentHeight/2 * cosTh)
      }
      var mb = {
        x: bl.x + (this.currentWidth/2 * cosTh),
        y: bl.y + (this.currentWidth/2 * sinTh)
      }
      
      // clockwise
      this.oCoords = { tl: tl, tr: tr, br: br, bl: bl, ml: ml, mt: mt, mr: mr, mb: mb };
      
      // set coordinates of the draggable boxes in the corners used to scale/rotate the image
      this._setCornerCoords();
      
      return this;
    },
    
    /**
     * Draws borders of an object's bounding box. 
     * Requires public properties: width, height
     * Requires public options: padding, borderColor
     * @method drawBorders
     * @param {CanvasRenderingContext2D} ctx Context to draw on
     * @return {fabric.Object} thisArg
     * @chainable
     */
    drawBorders: function(ctx) {
      var o = this.options,
          padding = o.padding,
          padding2 = padding * 2;
      
      ctx.save();
      
      ctx.globalAlpha = this.isMoving ? o.borderOpacityWhenMoving : 1;
      ctx.strokeStyle = o.borderColor;
      
      var scaleX = 1 / (this.scaleX < this.MIN_SCALE_LIMIT ? this.MIN_SCALE_LIMIT : this.scaleX),
          scaleY = 1 / (this.scaleY < this.MIN_SCALE_LIMIT ? this.MIN_SCALE_LIMIT : this.scaleY);
      
      // could be set by a group, that this object is contained within
      ctx.lineWidth = 1 / this.borderScaleFactor;
      
      ctx.scale(scaleX, scaleY);
      
      var w = this.getWidth(),
          h = this.getHeight();
      
      ctx.strokeRect(
        ~~(-(w / 2) - padding) + 0.5, // offset needed to make lines look sharper
        ~~(-(h / 2) - padding) + 0.5,
        ~~(w + padding2),
        ~~(h + padding2)
      );
      
      ctx.restore();
      return this;
    },
    
    /**
     * Draws corners of an object's bounding box.
     * Requires public properties: width, height, scaleX, scaleY 
     * Requires public options: cornersize, padding
     * @method drawCorners
     * @param {CanvasRenderingContext2D} ctx Context to draw on
     * @return {fabric.Object} thisArg
     * @chainable
     */
    drawCorners: function(ctx) {
      var size = this.options.cornersize,
          size2 = size / 2,
          padding = this.options.padding,
          left = -(this.width / 2),
          top = -(this.height / 2),
          _left, 
          _top,
          sizeX = size / this.scaleX,
          sizeY = size / this.scaleY,
          scaleOffsetY = (padding + size2) / this.scaleY,
          scaleOffsetX = (padding + size2) / this.scaleX,
          scaleOffsetSizeX = (padding + size2 - size) / this.scaleX,
          scaleOffsetSizeY = (padding + size2 - size) / this.scaleY;
          
      ctx.save();
      
      ctx.globalAlpha = this.isMoving ? this.options.borderOpacityWhenMoving : 1;
      ctx.fillStyle = this.options.cornerColor;
      
      // top-left
      _left = left - scaleOffsetX;
      _top = top - scaleOffsetY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      // top-right
      _left = left + this.width - scaleOffsetX;
      _top = top - scaleOffsetY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      // bottom-left
      _left = left - scaleOffsetX;
      _top = top + this.height + scaleOffsetSizeY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      // bottom-right
      _left = left + this.width + scaleOffsetSizeX;
      _top = top + this.height + scaleOffsetSizeY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      // middle-top
      _left = left + this.width/2 - scaleOffsetX;
      _top = top - scaleOffsetY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      // middle-bottom
      _left = left + this.width/2 - scaleOffsetX;
      _top = top + this.height + scaleOffsetSizeY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      // middle-right
      _left = left + this.width + scaleOffsetSizeX;
      _top = top + this.height/2 - scaleOffsetY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      // middle-left
      _left = left - scaleOffsetX;
      _top = top + this.height/2 - scaleOffsetY;
      ctx.fillRect(_left, _top, sizeX, sizeY);
      
      ctx.restore();
      
      return this;
    },
    
    /**
     * Clones an instance
     * @method clone
     * @param {Object} options object
     * @return {fabric.Object} clone of an instance
     */
    clone: function(options) {
      if (this.constructor.fromObject) {
        return this.constructor.fromObject(this.toObject(), options);
      }
      return new fabric.Object(this.toObject());
    },
    
    /**
     * Creates an instance of fabric.Image out of an object
     * @method cloneAsImage
     * @param callback {Function} callback, invoked with an instance as a first argument
     * @return {fabric.Object} thisArg
     * @chainable
     */
    cloneAsImage: function(callback) {
      if (fabric.Image) {
        var i = new Image();
        
        /** @ignore */
        i.onload = function() {
          if (callback) {
            callback(new fabric.Image(i), orig);
          }
          i = i.onload = null;
        };
        
        var orig = {
          angle: this.get('angle'),
          flipX: this.get('flipX'),
          flipY: this.get('flipY')
        };

        // normalize angle
        this.set('angle', 0).set('flipX', false).set('flipY', false);
        i.src = this.toDataURL();
      }
      return this;
    },
    
    /**
     * Converts an object into a data-url-like string
     * @method toDataURL
     * @return {String} string of data
     */
    toDataURL: function() {
      var el = document.createElement('canvas');
      
      el.width = this.getWidth();
      el.height = this.getHeight();
      
      fabric.util.wrapElement(el, 'div');

      var canvas = new fabric.Element(el);
      canvas.backgroundColor = 'transparent';
      canvas.renderAll();
      
      var clone = this.clone();
      clone.left = el.width / 2;
      clone.top = el.height / 2;
      
      clone.setActive(false);
      
      canvas.add(clone);
      var data = canvas.toDataURL('png');
      
      canvas.dispose();
      canvas = clone = null;
      return data;
    },
    
    /**
     * @method hasStateChanged
     * @return {Boolean} true if instance' state has changed
     */
    hasStateChanged: function() {
      return this.stateProperties.some(function(prop) {
        return this[prop] !== this.originalState[prop];
      }, this);
    },
    
    /**
     * @method saveState
     * @return {fabric.Object} thisArg
     * @chainable
     */
    saveState: function() {
      this.stateProperties.forEach(function(prop) {
        this.originalState[prop] = this.get(prop);
      }, this);
      return this;
    },
    
    /**
     * Returns true if object intersects with an area formed by 2 points
     * @method intersectsWithRect
     * @param {Object} selectionTL
     * @param {Object} selectionBR
     * @return {Boolean}
     */
    intersectsWithRect: function(selectionTL, selectionBR) {
      var oCoords = this.oCoords,
          tl = new fabric.Point(oCoords.tl.x, oCoords.tl.y),
          tr = new fabric.Point(oCoords.tr.x, oCoords.tr.y),
          bl = new fabric.Point(oCoords.bl.x, oCoords.bl.y),
          br = new fabric.Point(oCoords.br.x, oCoords.br.y);
      
      var intersection = fabric.Intersection.intersectPolygonRectangle(
        [tl, tr, br, bl],
        selectionTL,
        selectionBR
      );
      return (intersection.status === 'Intersection');
    },
    
    /**
     * Returns true if object intersects with another object
     * @method intersectsWithObject
     * @param {Object} other Object to test
     * @return {Boolean}
     */
    intersectsWithObject: function(other) {
      // extracts coords
      function getCoords(oCoords) {
        return {
          tl: new fabric.Point(oCoords.tl.x, oCoords.tl.y),
          tr: new fabric.Point(oCoords.tr.x, oCoords.tr.y),
          bl: new fabric.Point(oCoords.bl.x, oCoords.bl.y),
          br: new fabric.Point(oCoords.br.x, oCoords.br.y)
        }
      }
      var thisCoords = getCoords(this.oCoords),
          otherCoords = getCoords(other.oCoords);
      var intersection = fabric.Intersection.intersectPolygonPolygon(
        [thisCoords.tl, thisCoords.tr, thisCoords.br, thisCoords.bl],
        [otherCoords.tl, otherCoords.tr, otherCoords.br, otherCoords.bl]
      );
      
      return (intersection.status === 'Intersection');
    },
    
    /**
     * Returns true if object is fully contained within area formed by 2 points
     * @method isContainedWithinRect
     * @param {Object} selectionTL
     * @param {Object} selectionBR
     * @return {Boolean}
     */
    isContainedWithinRect: function(selectionTL, selectionBR) {
      var oCoords = this.oCoords,
          tl = new fabric.Point(oCoords.tl.x, oCoords.tl.y),
          tr = new fabric.Point(oCoords.tr.x, oCoords.tr.y),
          bl = new fabric.Point(oCoords.bl.x, oCoords.bl.y),
          br = new fabric.Point(oCoords.br.x, oCoords.br.y);
      return tl.x > selectionTL.x
        && tr.x < selectionBR.x
        && tl.y > selectionTL.y
        && bl.y < selectionBR.y;
    },
    
    /**
     * @method isType
     * @param type {String} type to check against
     * @return {Boolean} true if specified type is identical to the type of instance
     */
    isType: function(type) {
      return this.type === type;
    },
    
    /**
     * Determines which one of the four corners has been clicked
     * @method _findTargetCorner
     * @private
     * @param e {Event} event object
     * @param offset {Object} canvas offset
     * @return {String|Boolean} corner code (tl, tr, bl, br, etc.), or false if nothing is found
     */
    _findTargetCorner: function(e, offset) {
      var pointer = getPointer(e),
          ex = pointer.x - offset.left,
          ey = pointer.y - offset.top,
          xpoints,
          lines;
      
      for (var i in this.oCoords) {
        lines = this._getImageLines(this.oCoords[i].corner, i);
        xpoints = this._findCrossPoints(ex, ey, lines);
        if (xpoints % 2 == 1 && xpoints != 0) {
          this.__corner = i;
          return i;
        }   
      }
      return false;
    },
    
    /**
     * Helper method to determine how many cross points are between the 4 image edges
     * and the horizontal line determined by the position of our mouse when clicked on canvas
     * @method _findCrossPoints
     * @private
     * @param ex {Number} x coordinate of the mouse
     * @param ey {Number} y coordinate of the mouse
     * @param oCoords {Object} Coordinates of the image being evaluated
     */   
    _findCrossPoints: function(ex, ey, oCoords) {
      var b1, b2, a1, a2, xi, yi,
          xcount = 0,
          iLine;
          
      for (var lineKey in oCoords) {
        iLine = oCoords[lineKey];
        // optimisation 1: line below dot. no cross
        if ((iLine.o.y < ey) && (iLine.d.y < ey)) {
          continue;
        }
        // optimisation 2: line above dot. no cross
        if ((iLine.o.y >= ey) && (iLine.d.y >= ey)) {
          continue;
        }
        // optimisation 3: vertical line case
        if ((iLine.o.x == iLine.d.x) && (iLine.o.x >= ex)) { 
          xi = iLine.o.x;
          yi = ey;
        }
        // calculate the intersection point
        else {
          b1 = 0;
          b2 = (iLine.d.y-iLine.o.y)/(iLine.d.x-iLine.o.x); 
          a1 = ey-b1*ex;
          a2 = iLine.o.y-b2*iLine.o.x;

          xi = - (a1-a2)/(b1-b2); 
          yi = a1+b1*xi; 
        }
        // dont count xi < ex cases
        if (xi >= ex) { 
          xcount += 1;
        }
        // optimisation 4: specific for square images
        if (xcount == 2) {
          break;
        }
      }
      return xcount;
    },
    
    /**
     * Method that returns an object with the image lines in it given the coordinates of the corners
     * @method _getImageLines
     * @private
     * @param oCoords {Object} coordinates of the image corners
     */
    _getImageLines: function(oCoords, i) {
      return {
        topline: { 
          o: oCoords.tl,
          d: oCoords.tr
        },
        rightline: { 
          o: oCoords.tr,
          d: oCoords.br 
        },
        bottomline: { 
          o: oCoords.br,
          d: oCoords.bl 
        },
        leftline: { 
          o: oCoords.bl,
          d: oCoords.tl 
        }
      }
    },
    
    /**
     * Sets the coordinates of the draggable boxes in the corners of
     * the image used to scale/rotate it.
     * @method _setCornerCoords
     * @private
     */ 
    _setCornerCoords: function() {
      var coords = this.oCoords,
          theta = this.theta,
          cosOffset = this.cornersize * /*this.scaleX * */ Math.cos(theta),
          sinOffset = this.cornersize * /*this.scaleY * */ Math.sin(theta),
          size2 = this.cornersize / 2,
          size2x = size2 - sinOffset,
          size2y = size2,
          corner;
      
      coords.tl.x -= size2x;
      coords.tl.y -= size2y;
      
      coords.tl.corner = {
        tl: {
          x: coords.tl.x,
          y: coords.tl.y
        },
        tr: {
          x: coords.tl.x + cosOffset,
          y: coords.tl.y + sinOffset
        },
        bl: {
          x: coords.tl.x - sinOffset,
          y: coords.tl.y + cosOffset
        }
      };
      coords.tl.corner.br = {
        x: coords.tl.corner.tr.x - sinOffset,
        y: coords.tl.corner.tr.y + cosOffset
      };
      
      coords.tl.x += size2x;
      coords.tl.y += size2y;
      
      coords.tr.x += size2;
      coords.tr.y -= size2;
      coords.tr.corner = {
        tl: {
          x: coords.tr.x - cosOffset,
          y: coords.tr.y - sinOffset
        },
        tr: {
          x: coords.tr.x,
          y: coords.tr.y
        },
        br: {
          x: coords.tr.x - sinOffset,
          y: coords.tr.y + cosOffset
        }
      };
      coords.tr.corner.bl = {
        x: coords.tr.corner.tl.x - sinOffset,
        y: coords.tr.corner.tl.y + cosOffset
      };
      coords.tr.x -= size2;
      coords.tr.y += size2;
      
      coords.bl.x -= size2;
      coords.bl.y += size2;
      coords.bl.corner = {
        tl: {
          x: coords.bl.x + sinOffset,
          y: coords.bl.y - cosOffset
        },
        bl: {
          x: coords.bl.x,
          y: coords.bl.y
        },
        br: {
          x: coords.bl.x + cosOffset,
          y: coords.bl.y + sinOffset
        }
      };
      coords.bl.corner.tr = {
        x: coords.bl.corner.br.x + sinOffset,
        y: coords.bl.corner.br.y - cosOffset
      };
      coords.bl.x += size2;
      coords.bl.y -= size2;
      
      coords.br.x += size2;
      coords.br.y += size2;
      coords.br.corner = {
        tr: {
          x: coords.br.x + sinOffset,
          y: coords.br.y - cosOffset
        },
        bl: {
          x: coords.br.x - cosOffset,
          y: coords.br.y - sinOffset
        },
        br: {
          x: coords.br.x,
          y: coords.br.y
        }
      };
      coords.br.corner.tl = {
        x: coords.br.corner.bl.x + sinOffset,
        y: coords.br.corner.bl.y - cosOffset
      };
      coords.br.x -= size2;
      coords.br.y -= size2;
      
      
      coords.ml.x -= size2;
      coords.ml.y -= size2;
      coords.ml.corner = {
        tl: {
          x: coords.ml.x,
          y: coords.ml.y
        },
        tr: {
          x: coords.ml.x + cosOffset,
          y: coords.ml.y + sinOffset
        },
        bl: {
          x: coords.ml.x - sinOffset,
          y: coords.ml.y + cosOffset
        }
      };
      coords.ml.corner.br = {
        x: coords.ml.corner.tr.x - sinOffset,
        y: coords.ml.corner.tr.y + cosOffset
      };
      coords.ml.x += size2;
      coords.ml.y += size2;
      
      coords.mt.x -= size2;
      coords.mt.y -= size2;
      coords.mt.corner = {
        tl: {
          x: coords.mt.x,
          y: coords.mt.y
        },
        tr: {
          x: coords.mt.x + cosOffset,
          y: coords.mt.y + sinOffset
        },
        bl: {
          x: coords.mt.x - sinOffset,
          y: coords.mt.y + cosOffset
        }
      };
      coords.mt.corner.br = {
        x: coords.mt.corner.tr.x - sinOffset,
        y: coords.mt.corner.tr.y + cosOffset
      };
      coords.mt.x += size2;
      coords.mt.y += size2;
      
      coords.mr.x -= size2;
      coords.mr.y -= size2;
      coords.mr.corner = {
        tl: {
          x: coords.mr.x,
          y: coords.mr.y
        },
        tr: {
          x: coords.mr.x + cosOffset,
          y: coords.mr.y + sinOffset
        },
        bl: {
          x: coords.mr.x - sinOffset,
          y: coords.mr.y + cosOffset
        }
      };
      coords.mr.corner.br = {
        x: coords.mr.corner.tr.x - sinOffset,
        y: coords.mr.corner.tr.y + cosOffset
      };
      coords.mr.x += size2;
      coords.mr.y += size2;
      
      coords.mb.x -= size2;
      coords.mb.y -= size2;
      coords.mb.corner = {
        tl: {
          x: coords.mb.x,
          y: coords.mb.y
        },
        tr: {
          x: coords.mb.x + cosOffset,
          y: coords.mb.y + sinOffset
        },
        bl: {
          x: coords.mb.x - sinOffset,
          y: coords.mb.y + cosOffset
        }
      };
      coords.mb.corner.br = {
        x: coords.mb.corner.tr.x - sinOffset,
        y: coords.mb.corner.tr.y + cosOffset
      };
      
      coords.mb.x += size2;
      coords.mb.y += size2;
      
      corner = coords.mb.corner;
      
      corner.tl.x -= size2;
      corner.tl.y -= size2;
      corner.tr.x -= size2;
      corner.tr.y -= size2;
      corner.br.x -= size2;
      corner.br.y -= size2;
      corner.bl.x -= size2;
      corner.bl.y -= size2;
    },
    
    /**
     * Makes object's color grayscale
     * @method toGrayscale
     * @return {fabric.Object} thisArg
     */
    toGrayscale: function() {
      var fillValue = this.get('fill');
      if (fillValue) {
        this.set('overlayFill', new fabric.Color(fillValue).toGrayscale().toRgb());
      }
      return this;
    },
    
    /**
     * @method complexity
     * @return {Number}
     */
    complexity: function() {
      return 0;
    },
    
    /**
     * @method getCenter
     * @return {Object} object with `x`, `y` properties corresponding to path center coordinates
     */
    getCenter: function() {
      return {
        x: this.get('left') + this.width / 2,
        y: this.get('top') + this.height / 2
      };
    },
    
    /**
     * @method straighten
     * @return {fabric.Object} thisArg
     * @chainable
     */
    straighten: function() {
      var angle = this._getAngleValueForStraighten();
      this.setAngle(angle);
      return this;
    },
    
    /**
     * @method fxStraighten
     * @param {Object} callbacks
     *                  - onComplete: invoked on completion
     *                  - onChange: invoked on every step of animation
     *
     * @return {fabric.Object} thisArg
     * @chainable
     */
    fxStraighten: function(callbacks) {
      callbacks = callbacks || { };
      
      var empty = function() { },
          onComplete = callbacks.onComplete || empty,
          onChange = callbacks.onChange || empty,
          _this = this;
      
      fabric.util.animate({
        startValue: this.get('angle'),
        endValue: this._getAngleValueForStraighten(),
        duration: this.FX_DURATION,
        onChange: function(value) {
          _this.setAngle(value);
          onChange();
        },
        onComplete: function() {
          _this.setCoords();
          onComplete();
        },
        onStart: function() {
          _this.setActive(false);
        }
      });
      
      return this;
    },
    
    /**
     * @method fxRemove
     * @param {Object} callbacks
     * @return {fabric.Object} thisArg
     * @chainable
     */
    fxRemove: function(callbacks) {
      callbacks || (callbacks = { });
      
      var empty = function() { },
          onComplete = callbacks.onComplete || empty,
          onChange = callbacks.onChange || empty,
          _this = this;
      
      fabric.util.animate({
        startValue: this.get('opacity'),
        endValue: 0,
        duration: this.FX_DURATION,
        onChange: function(value) {
          _this.set('opacity', value);
          onChange();
        },
        onComplete: onComplete,
        onStart: function() {
          _this.setActive(false);
        }
      });
      
      return this;
    },
    
    /**
     * @method _getAngleValueForStraighten
     * @return {Number} angle value
     * @private
     */
    _getAngleValueForStraighten: function() {
      var angle = this.get('angle');
      
      // TODO (kangax): can this be simplified?
      
      if      (angle > -225 && angle <= -135) { return -180;  }
      else if (angle > -135 && angle <= -45)  { return  -90;  }
      else if (angle > -45  && angle <= 45)   { return    0;  }
      else if (angle > 45   && angle <= 135)  { return   90;  }
      else if (angle > 135  && angle <= 225 ) { return  180;  }
      else if (angle > 225  && angle <= 315)  { return  270;  }
      else if (angle > 315)                   { return  360;  }
      
      return 0;
    },
    
    /**
     * Returns a JSON representation of an instance
     * @method toJSON
     * @return {String} json
     */
    toJSON: function() {
      // delegate, not alias
      return this.toObject();
    }
  });
  
  /**
   * @alias rotate -> setAngle
   */
  fabric.Object.prototype.rotate = fabric.Object.prototype.setAngle;
})();