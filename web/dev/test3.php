<?php 

$direction = 'x'; // | y

?><!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">
<title>Test page</title>
<style>

body {
  margin: 0;
  background-color: #f0f0f0; 
}

html {
  /* permanent scroll bar */
  overflow-<?php print $direction; ?>: scroll;
}

.flex {
  display: -webkit-flex;
  -webkit-flex-direction: column;
  -webkit-flex-flow: column wrap;
  
  display: flex;
  flex-direction: column;
  flex-flow: column wrap;
  
  height: 100%;
  background-color: #999900;
}

.flex li {
  width: 300px;
  height: 200px;
}

.grid {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-template-rows: auto auto auto;
}

</style>
<script src="//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js" ></script>
<script type="text/javascript">

debug = true;

$(document).ready(function(){
  // read all the stylesheets and find all the rules which feature screenpc
  var rules = document.styleSheets[0].rules || document.styleSheets[0].cssRules;
  for (var i=0; i < rules.length; i++) {
    var rule = rules[i];
    if (rule.selectorText.toLowerCase() == ".largefield") {
      alert(rule.style.getPropertyValue("width"));
    }
  }
  $('.screenpc-width').each(function() {
    return genpc($(this), 'width');
  });
  $('.screenpc-height').each(function() {
    return genpc($(this), 'height');
  });
    // call refresh function to apply widths/heights
  refresh();
});

function refresh() {
  var win = $(window);
  var wx = win.width(), wh = win.height();
  var pcwidth = undefined, pcheight = undefined;
  $('.screenpc').each(function() {
    // read data-screen-pc-width|height if set
    pcwidth = $(this).data("screen-pc-width");
    pcheight = $(this).data("screen-pc-height");
    if (debug) {
      console.log("screenpc["+$(this).attr('id')+"] w["+pcwidth+"] h["+pcheight+"]");
    }
  });
}

function genpc(jq, axis) {
  var elemclass, elemid, elempc;
  // parse stylesheets for id:width
  elemid = jq.attr('id');
  // parse stylesheets for class(n):width
  elempc = lookupSelectorProp('#'+elemid, axis);
  if (elempc != undefined) {
    // found width on #id, apply to data
    jq.data('screen-pc-'+axis, elempc);
  } else {
    // break class list into array
    elemclass = jq.attr('class').split(' ');
    // search list for a class defined in stylesheet
    for (var i=0 ; i<elemclass.length ; i++) {
      var elemc = elemclass[i];
      // lookup class in style sheets to find width definition
      elempc = lookupSelectorProp('.'+elemc, axis);
      if (elempc != undefined) {
        // found width, apply to data
        jq.data('screen-pc-'+axis, elempc);
        // don't carry on the search
        break;
      }
    }
  }
}

function lookupSelectorProp(elem, axis) {
  
}

</script>
</head>
<body>
<ul class="flex screenpc-height">
<li><img src="flow.jpg" alt="1" /></li>
<li>2</li>
<li><img src="flow.jpg" alt="3" /></li>
<li><img src="flow.jpg" alt="4" /></li>
<li><img src="flow.jpg" alt="5" /></li>
<li>6</li>
<li><img src="flow.jpg" alt="7" /></li>
<li><img src="flow.jpg" alt="8" /></li>
<li>9</li>
<li>10</li>
<li>11</li>
<li>12</li>
<li><img src="flow.jpg" alt="1" /></li>
<li>14</li>
<li><img src="flow.jpg" alt="3" /></li>
<li><img src="flow.jpg" alt="4" /></li>
<li><img src="flow.jpg" alt="5" /></li>
<li>18</li>
<li><img src="flow.jpg" alt="7" /></li>
<li><img src="flow.jpg" alt="8" /></li>
<li>21</li>
<li>22</li>
<li>23</li>
<li>24</li>
</ul>
</body>
</html>