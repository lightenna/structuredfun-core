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
  //overflow-<?php print $direction; ?>: scroll;
}

#topcoat {
  /* make div same size as contents */
  overflow: hidden;
  <?php if ($direction == 'x') {?>
  /* flow elements horizontally */
  float: left;
  <?php } ?>
}

.full {
  width: 100%;
  height: 100%;
  position: absolute;
  margin: 0;
  padding: 0;
  border-spacing: 0;
}

.full td {
  text-align: center;
}

.red {
  background-color: #ff0000;
}

.white {
  background-color: #ffffff;
}

</style>
<script src="//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js" ></script>
<script type="text/javascript">

$(document).ready(function(){
  // find topcoat and resize it to its current size (% -> px)
  // height hack because div around 100% table doesn't get given height
  var tw = $('#topcoat table').width(), th = $('#topcoat table').height();
  // set height back on table
  $('#topcoat table').width(tw).height(th);
  // add more content to topcoat
  $('#topcoat').append('<p>Appended</p>');
  // expand width/height of page
  $('body').width(2000);
});

</script>
</head>
<body>
<div id="topcoat">
<table class="full red">
<tbody>
<tr>
<td>1</td>
<td class="white">2</td>
</tr>
<tr>
<td class="white">3</td>
<td>4</td>
</tr>
</tbody>
</table>
</div><!-- /#topcoat -->
</body>
</html>