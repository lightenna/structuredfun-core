<?php

$docroot = $_SERVER['DOCUMENT_ROOT'];

// correct for symfony
$docroot .= '/../../../';

$zipname = $docroot.'data/data.zip';
// $zipname = dirname(__FILE__) . '/../../data/data.zip';
// $zipname = dirname(__FILE__) . '/../../data/test.zip';
$name = 'zip://' . $zipname . '#test1.jpg';

// phpinfo();
listContents($zipname);
// genImage($name);

function genImage($name) {
	$fp = fopen($name, 'r');
	if (!$fp) {
		exit("cannot open ${name} \n");
	}

	// send the right headers
	header("Content-Type: image/jpeg");
	// cannot use filesize() with zip stream
	// header("Content-Length: " . filesize($name));

	// dump the picture and stop the script
	fpassthru($fp);
	exit;
}

function listContents($name) {
    echo $name . "<br />\n";
	$zip = zip_open($name);

	if ($zip) {
		while ($zip_entry = zip_read($zip)) {
			echo "Name:               " . zip_entry_name($zip_entry) . "<br />\n";
			echo "Actual Filesize:    " . zip_entry_filesize($zip_entry) . "<br />\n";
			echo "Compressed Size:    " . zip_entry_compressedsize($zip_entry) . "<br />\n";
			echo "Compression Method: " . zip_entry_compressionmethod($zip_entry) . "<br />\n";

			if (zip_entry_open($zip, $zip_entry, "r")) {
				echo "File Contents:\n";
				zip_entry_close($zip_entry);
			}
			echo "<br />\n";
		}
		zip_close($zip);
	} else {
		echo 'error';
	}
}

?>