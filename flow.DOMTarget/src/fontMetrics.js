// let metrics = null;

/**
 * Cached text dimensions. 
 */
 export function fitTextWithinWidth(text, targetWidth, fontWeight) {
    if (!fontWeight) fontWeight = 400;
    let lowerLimitFontSize = 0;
    let lowerLimitWidth;
  
    // let charBasedFactor = 1/(text.length) * 2;
    let experimentalFactor = 0.324;
    let guessFontSize = targetWidth * experimentalFactor;
    let guessWidth;
  
    // guessWidth = uncachedTextWidth(text, guessFontSize, fontWeight); 
    // log("Difference: " + (guessWidth - targetWidth));
    
    let upperLimitFontSize = guessFontSize * 2;
    let upperLimitWidth;
    
    // return guessFontSize; // Somehow this seems to work pretty ok... without any font analysis...
    
    let iterations = 10;
    while(iterations-- > 0) {
      guessWidth = uncachedTextWidth(text, guessFontSize, fontWeight); 
      // log("fresh guess width: " + guessWidth);
      if (guessWidth == targetWidth) {
        return guessFontSize;
      } else if (guessWidth > targetWidth) {
        // Too big, move scope to lower
        upperLimitFontSize = guessFontSize;
        upperLimitWidth = guessWidth;
  
        guessFontSize = (guessFontSize + lowerLimitFontSize) / 2; 
      } else if (guessWidth < targetWidth) {
        // Too small, move scope to bigger sizes
        lowerLimitFontSize = guessFontSize;
        lowerLimitWidth = guessWidth;
  
        guessFontSize = (guessFontSize + upperLimitFontSize) / 2; 
      }
    }
  
    // log("Difference: " + (guessWidth - targetWidth));
    // log("Factor: " + guessFontSize / targetWidth);
    return guessFontSize;
  }
  
  
  
  export function fitTextWithinCapHeight(targetHeight) {
    const fontSize = targetHeight / getFontSizeToCapHeightRatio();
    return fontSize;
  }
  
  
  
  /**
   * Cached text dimensions. 
   */
  const textMeasures = {};
  
  export function textWidth(text, styleOrFontSize) {
    return textDimensions(text, styleOrFontSize).width;
  }
  
  export function textHeight(text, styleOrFontSize) {
    return textDimensions(text, styleOrFontSize).height;
  }
  
  // Note: textDimensions might overestimate the width of the string with a rounding error. To underestimate, subtract the result by 1. 
  export function textDimensions(text, styleOrFontSize) {
    if (typeof(styleOrFontSize) === "undefined") styleOrFontSize = 13;
    if (typeof(styleOrFontSize) === "number") styleOrFontSize = {fontSize: styleOrFontSize}
    const style = styleOrFontSize;
    const fontSize = style.fontSize ? style.fontSize : 13;
    const fontWeight = style.fontWeight ? style.fontWeight : 400; 
    const styleKey = fontSize + ":" + fontWeight; 
  
    if (typeof(textMeasures[styleKey]) === "undefined") {
      textMeasures[styleKey] = uncachedTextDimensions(text, fontSize, fontWeight);
    }
  
    const styleBucket = textMeasures[styleKey];
  
    if (typeof(styleBucket[text]) === "undefined") {
      styleBucket[text] = uncachedTextDimensions(text, fontSize, fontWeight);
    }
    return styleBucket[text];
  }
  
  
  /**
   * Perform actual experiments with dom elements. 
   */
  export function uncachedTextWidth(text, fontSize, fontWeight) {
    return uncachedTextDimensions(text, fontSize, fontWeight).width;
  }
  
  export function uncachedTextHeight(text, fontSize, fontWeight) {
    return uncachedTextDimensions(text, fontSize, fontWeight).height;
  }
  
  export function uncachedTextDimensions(text, fontSize, fontWeight) {
     // Create a div only containing the said text.
    const parentElement = document.body;
    let div = document.createElement('div');
    div.style["font-weight"] = fontWeight;
    div.style["font-size"] = fontSize + "px";
    div.style["white-space"] = "pre";
    div.style["position"] = "absolute";
    div.style["margin"] = "0px";
    div.style["padding"] = "0px";
    div.innerHTML = text;
    parentElement.appendChild(div);
  
    // Measure it & remove
    let width = (div.clientWidth + 1);
    let height = (div.scrollHeight + 1);
    parentElement.removeChild(div);
  
    return {
      width: width,
      height: height
    }
  }
  
  
  /**
   * Font size to cap height ratio. 
   */
  let fontSizeToCapHeightRatio = null;
  
  export function capHeight(fontSize) {
    return Math.ceil(getFontSizeToCapHeightRatio() * fontSize);  
  }
  
  export function getFontSizeToCapHeightRatio() {
    if (!fontSizeToCapHeightRatio) {
      const fontSize = 60; 
      const metrics = getMetrics('Roboto', fontSize +'px');
      fontSizeToCapHeightRatio = metrics.px.ascent / fontSize;
    }
    return fontSizeToCapHeightRatio;
  }
  
  export function getGoldenRatioTopPadding(wrapperHeight, contentHeight) {
    const gRatio = 1.618;
    const emptySpace = wrapperHeight - contentHeight;
    return emptySpace - (emptySpace / gRatio);
  }
  
  /**
   * getMetrics (based on this: https://codepen.io/sebilasse/pen/gPBQqm?editors=1010)
   */
  function getMetrics(fontName, fontSize) {
    let myCanvas = document.createElement('canvas');
    myCanvas.style["width"] = "200px";
    myCanvas.style["height"] = "200px";
    document.body.appendChild(myCanvas);
  
    let testtext = "Sixty Handgloves ABC";
    // if there is no getComputedStyle, this library won't work.
    if(!document.defaultView.getComputedStyle) {
      throw("ERROR: 'document.defaultView.getComputedStyle' not found. This library only works in browsers that can report computed CSS values.");
    }
  
    /**
     *  shortcut function for getting computed CSS values
     */
    let getCSSValue = function(element, property) {
      return document.defaultView.getComputedStyle(element,null).getPropertyValue(property);
    };
  
    // debug function
    let show = function(canvas, ctx, xstart, w, h, metrics)
    {
      document.body.appendChild(canvas);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  
      ctx.beginPath();
      ctx.moveTo(xstart,0);
      ctx.lineTo(xstart,h);
      ctx.closePath();
      ctx.stroke(); 
  
      ctx.beginPath();
      ctx.moveTo(xstart+metrics.bounds.maxx,0);
      ctx.lineTo(xstart+metrics.bounds.maxx,h);
      ctx.closePath();
      ctx.stroke(); 
  
      ctx.beginPath();
      ctx.moveTo(0,h/2-metrics.ascent);
      ctx.lineTo(w,h/2-metrics.ascent);
      ctx.closePath();
      ctx.stroke(); 
  
      ctx.beginPath();
      ctx.moveTo(0,h/2+metrics.descent);
      ctx.lineTo(w,h/2+metrics.descent);
      ctx.closePath();
      ctx.stroke();
    }
  
    /**
     * The new text metrics function
     */
    CanvasRenderingContext2D.prototype.measureTextNew = function(textstring) {
      // log("measure text...");
      let metrics = this.measureText(textstring),
          fontFamily = getCSSValue(this.canvas,"font-family"),
          fontSize = getCSSValue(this.canvas,"font-size").replace("px",""),
          isSpace = !(/\S/.test(textstring));
          metrics.fontsize = fontSize;
      // log("...");
  
      // for text lead values, we meaure a multiline text container.
      let leadDiv = document.createElement("div");
      leadDiv.style.position = "absolute";
      leadDiv.style.margin = 0;
      leadDiv.style.padding = 0;
      leadDiv.style.opacity = 0;
      leadDiv.style.font = fontSize + "px " + fontFamily;
      leadDiv.innerHTML = textstring + "<br/>" + textstring;
      document.body.appendChild(leadDiv);
  
      // make some initial guess at the text leading (using the standard TeX ratio)
      metrics.leading = 1.2 * fontSize;
  
      // then we try to get the real value from the browser
      let leadDivHeight = getCSSValue(leadDiv,"height");
      leadDivHeight = leadDivHeight.replace("px","");
      if (leadDivHeight >= fontSize * 2) { metrics.leading = (leadDivHeight/2) | 0; }
      document.body.removeChild(leadDiv);
  
      // if we're not dealing with white space, we can compute metrics
      if (!isSpace) {
          // Have characters, so measure the text
          let canvas = document.createElement("canvas");
          let padding = 100;
          canvas.width = metrics.width + padding;
          canvas.height = 3*fontSize;
          canvas.style.opacity = 1;
          canvas.style.fontFamily = fontFamily;
          canvas.style.fontSize = fontSize;
          let ctx = canvas.getContext("2d");
          ctx.font = fontSize + "px " + fontFamily;
  
          let w = canvas.width,
              h = canvas.height,
              baseline = h/2;
  
          // Set all canvas pixeldata values to 255, with all the content
          // data being 0. This lets us scan for data[i] != 255.
          ctx.fillStyle = "white";
          ctx.fillRect(-1, -1, w+2, h+2);
          ctx.fillStyle = "black";
          ctx.fillText(textstring, padding/2, baseline);
          let pixelData = ctx.getImageData(0, 0, w, h).data;
  
          // canvas pixel data is w*4 by h*4, because R, G, B and A are separate,
          // consecutive values in the array, rather than stored as 32 bit ints.
          let i = 0,
              w4 = w * 4,
              len = pixelData.length;
  
          // Finding the ascent uses a normal, forward scanline
          while (++i < len && pixelData[i] === 255) {}
          let ascent = (i/w4)|0;
  
          // Finding the descent uses a reverse scanline
          i = len - 1;
          while (--i > 0 && pixelData[i] === 255) {}
          let descent = (i/w4)|0;
  
          // find the min-x coordinate
          for(i = 0; i<len && pixelData[i] === 255; ) {
            i += w4;
            if(i>=len) { i = (i-len) + 4; }}
          let minx = ((i%w4)/4) | 0;
  
          // find the max-x coordinate
          let step = 1;
          for(i = len-3; i>=0 && pixelData[i] === 255; ) {
            i -= w4;
            if(i<0) { i = (len - 3) - (step++)*4; }}
          let maxx = ((i%w4)/4) + 1 | 0;
  
          // set font metrics
          metrics.ascent = (baseline - ascent);
          metrics.descent = (descent - baseline);
          metrics.bounds = { minx: minx - (padding/2),
                             maxx: maxx - (padding/2),
                             miny: 0,
                             maxy: descent-ascent };
          metrics.height = 1+(descent - ascent);
      }
      
      // if we ARE dealing with whitespace, most values will just be zero.
      else {
          // Only whitespace, so we can't measure the text
          metrics.ascent = 0;
          metrics.descent = 0;
          metrics.bounds = { minx: 0,
                             maxx: metrics.width, // Best guess
                             miny: 0,
                             maxy: 0 };
          metrics.height = 0;
      }
      return metrics;
    };
    //callback();
    let WebFontConfig = {
      google: { 
        families: [ [encodeURIComponent(fontName),'::latin'].join('') ] 
      }
    };
    let wf = document.createElement('script');
    wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
      '://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
    wf.type = 'text/javascript';
    wf.async = 'true';
    let s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(wf, s);
    document.body.style.fontFamily = ['"'+fontName+'"', "Arial sans"].join(' ')
    let canvas = myCanvas; //document.getElementById('cvs'),
    let context = canvas.getContext("2d");
  
    let w=220, h=220;
  
    canvas.style.font = [fontSize, fontName].join(' ');
    context.font = [fontSize, fontName].join(' ');
    context.clearRect(0, 0, canvas.width, canvas.height);
    // draw bounding box and text
    let xHeight = context.measureTextNew("x").height;
    let capHeight = context.measureTextNew("H").height;
    let metrics = context.measureTextNew("Hxy");
    let xStart = (w - metrics.width)/2;
    context.fontFamily = fontName;
    context.fillStyle = "#FFAF00";
    context.fillRect(xStart, h/2-metrics.ascent, metrics.bounds.maxx-metrics.bounds.minx, 1+metrics.bounds.maxy-metrics.bounds.miny);
    context.fillStyle = "#333333";
    context.fillText(testtext, xStart, h/2);
    metrics.fontsize = parseInt(metrics.fontsize);
    metrics.offset = Math.ceil((metrics.leading - metrics.height) / 2);
    // metrics.width = JSON.parse(JSON.stringify(metrics.width));
    // metrics.capHeight = capHeight;
    // metrics.xHeight = xHeight - 1;
    // metrics.ascender = metrics.capHeight - metrics.xHeight;
    // metrics.descender = metrics.descent;
    
    let myMetrics = {
      px: JSON.parse(JSON.stringify(metrics)),
      relative: {
        fontsize: 1,
        offset: (metrics.offset / metrics.fontsize),
        height: (metrics.height / metrics.fontsize),
        capHeight: (metrics.capHeight / metrics.fontsize),
        ascender: (metrics.ascender / metrics.fontsize),
        xHeight: (metrics.xHeight / metrics.fontsize),
        descender: (metrics.descender / metrics.fontsize)
      },
      descriptions: {
        ascent: 'distance above baseline',
        descent: 'distance below baseline',
        height: 'ascent + 1 for the baseline + descent',
        leading: 'distance between consecutive baselines',
        bounds: { 
          minx: 'can be negative',
          miny: 'can also be negative',
          maxx: 'not necessarily the same as metrics.width',
          maxy: 'not necessarily the same as metrics.height'
        },
        capHeight: 'height of the letter H',
        ascender: 'distance above the letter x',
        xHeight: 'height of the letter x (1ex)',
        descender: 'distance below the letter x'
      }
    }
    
    Array.prototype.slice.call(
      document.getElementsByTagName('canvas'), 0
    ).forEach(function(c, i){
      if (i > 0) document.body.removeChild(c);
    });
    
    document.body.removeChild(myCanvas);
    return myMetrics;
  }