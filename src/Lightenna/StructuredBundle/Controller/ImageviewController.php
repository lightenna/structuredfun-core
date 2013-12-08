<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class ImageviewController extends ViewController
{
	public function indexAction($name)
	{
		// parse args to work out what to return
		$args = self::getArgsFromPath($name);
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
				$stats['filezip'] = $zip;
				$this->printImage($stats, $args);
				$zip->close();
			}
		} else {
			// convert urlname to fs filename
			$filename = self::getFileBitFromPath($name);
			$filefull = self::convertUrlToFilename($filename);
			// open the image file
			$fp = fopen($filefull, 'rb');
			if ($fp) {
				$stats = array(
					'name' => $filefull,
					'file' => $fp,
					'size' => filesize($filefull),
				);
				// process the picture
				$this->printImage($stats, $args);
				fclose($fp);			
			}
		}
		exit;
	}

	/**
	 * print out an image based on an array of its metadata
	 * @param array $stats Array of metadata
	 */
	public function printImage($stats, $args) {
		// send the right headers
		header("Content-Type: image/" . self::getExtension($stats['name']));
		header("Content-Length: " . $stats['size']);
		if (isset($args['maxwidth']) || isset($args['maxheight'])) {
			// resize the image
			// START HERE
			// TEMP: dump the picture depending on source
			if (isset($stats['file'])) {
				fpassthru($stats['file']);
			} else if (isset($stats['filezip'])) {
				echo $stats['filezip']->getFromName($stats['name']);
			}
		} else {
			// dump the picture depending on source
			if (isset($stats['file'])) {
				fpassthru($stats['file']);
			} else if (isset($stats['filezip'])) {
				echo $stats['filezip']->getFromName($stats['name']);
			}			
		}
	}

}
