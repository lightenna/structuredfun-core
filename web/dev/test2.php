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

.vertical {
  -moz-column-width: 15em;
  -moz-column-gap: 0;
  background-color: #999900;
  height: 900px;
}

.horizontal {
}

.horizontal .elem {
  float: left;
}

.container, .container .elem {
  margin: 0;
  padding: 0;
}

.container .elem {
  list-style: none inside none;
  width: 12em;
  height: 12em;
}

.container .elem img {
  width: 12em;
  height: 12em;
}

.container .elem:nth-child(odd) {
  background-color: #ff0000;
}
.container .elem:nth-child(even) {
  background-color: #ffffff;
}

</style>
<script src="//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js" ></script>
<script type="text/javascript">

$(document).ready(function(){

});

</script>
</head>
<body>
<!-- 
<ul class="vertical">
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
</ul>
 -->
<div class="container vertical">
<p class="elem"><img src="flow.jpg" alt="1" /></p>
<p class="elem">2</p>
<p class="elem"><img src="flow.jpg" alt="3" /></p>
<p class="elem"><img src="flow.jpg" alt="4" /></p>
<p class="elem"><img src="flow.jpg" alt="5" /></p>
<p class="elem">6</p>
<p class="elem"><img src="flow.jpg" alt="7" /></p>
<p class="elem"><img src="flow.jpg" alt="8" /></p>
<p class="elem">9</p>
<p class="elem">10</p>
<p class="elem">11</p>
<p class="elem">12</p>
</div>
</body>
</html>