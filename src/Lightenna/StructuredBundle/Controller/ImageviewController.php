<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class ImageviewController extends ViewController
{
	public function indexAction($name)
	{
		// print $name;
		// exit;
		// search path for any zip directories
		if (self::detectZipInPath($name) !== false) {
			$zipname = self::getZipBitFromZipPath($name);
			// convert path to zip to full path to zip
			$zipfull = self::convertUrlToFilename($zipname);
			// open up the zip file
			$zip = new \ZipArchive;
			if ($zip->open($zipfull) === true) {
				// work out the filename within the zip
				$filename = self::getFileBitFromZipPath($name);
				// pull information about this file
				$stats = $zip->statName($filename);
				// send the right headers
				header("Content-Type: image/" . self::getExtension($filename));
				header("Content-Length: " . $stats['size']);
				// dump the picture
				echo $zip->getFromName($filename);
				$zip->close();
			}
		} else {
			// convert urlname to fs filename
			$filename = self::convertUrlToFilename($name);
			// open the image file
			$fp = fopen($filename, 'rb');
			// send the right headers
			header("Content-Type: image/" . self::getExtension($filename));
			header("Content-Length: " . filesize($filename));
			// dump the picture
			fpassthru($fp);
			fclose($fp);
		}
		exit;
	}

}
