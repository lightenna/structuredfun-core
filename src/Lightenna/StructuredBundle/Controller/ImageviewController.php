<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class ImageviewController extends ViewController
{
	// @param Array image metadata array
	private $stats;
	// @param Array URL arguments array
	private $args;

	public function indexAction($name)
	{
		// parse args to work out what to return
		$this->args = self::getArgsFromPath($name);
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
				$this->stats = $zip->statName($filename);
				$this->stats['filezip'] = $zip;
				$this->printImage();
				$zip->close();
			}
		} else {
			// convert urlname to fs filename
			$filename = self::getFileBitFromPath($name);
			$filefull = self::convertUrlToFilename($filename);
			// open the image file
			$fp = fopen($filefull, 'rb');
			if ($fp) {
				$this->stats = array(
					'name' => $filefull,
					'file' => $fp,
					'size' => filesize($filefull),
				);
				// process the picture
				$this->printImage($this->stats, $this->args);
				fclose($fp);			
			}
		}
		exit;
	}

	/**
	 * overwrite the arguments array (used for testing)
	 * @param array $a new arguments array
	 */
	public function setArgs($a) {
		$this->args = $a;
	}

	/**
	 * @return array stats (metadata) array
	 */
	public function getStats() {
		return $this->stats;
	}

	/**
	 * print out an image based on an array of its metadata
	 * @param array $this->stats Array of metadata
	 */
	public function printImage() {
		// send the right headers
		$ext = strtolower(self::getExtension($this->stats['name']));
		header("Content-Type: image/" . $ext);
		header("Content-Length: " . $this->stats['size']);
		// load image into buffer
		$imgdata = $this->loadImage();
		if (isset($this->args['maxwidth']) || isset($this->args['maxheight'])) {
			// resize the image, depending on type
			$oldimg = imagecreatefromstring($imgdata);
			$this->imageCalcNewSize($oldimg);
			$img = $this->resizeImage($oldimg);
			// if we successfully read the image
			if ($img) {
				echo $imgdata;
			}
		} else {
			// dump the picture depending on source
			echo $imgdata;
		}
	}

	/**
	 * load image into a buffer
	 * @return image as a string
	 **/
	public function loadImage() {
		if (isset($this->stats['file'])) {
			return file_get_contents($this->stats['file']);
		} else if (isset($this->stats['filezip'])) {
			return $this->stats['filezip']->getFromName($this->stats['name']);
		}
	}

	/**
	 * resize image to width/height or both based on args
	 * @param resource $img The image
	 * @return resource 
	 */
	public function resizeImage($img) {
		// create a new image the correct shape and size
		$newimg = imagecreatetruecolor($this->stats['newwidth'], $this->stats['newheight']);
		return $newimg;
	}

	/**
	 * use original image and args to decide new image size
	 */
	public function imageCalcNewSize($img) {
		// clear old calculations
		unset($this->stats['newwidth']);
		unset($this->stats['newheight']);
		// find image orientation
		$width = imagesx($img);
		$height = imagesy($img);
		$portrait = false;
		if ($height > $width) {
			$portrait = true;
		}
		// catch case where we haven't restricted either dimension
		if (!isset($this->args['maxwidth']) && !isset($this->args['maxheight'])) {
			$this->stats['newwidth'] = $width;
			$this->stats['newheight'] = $height;
		}
		// resize based on longest edge and args
		// exactly 1 restriction is always set
		if ($portrait) {
			if (isset($this->args['maxheight'])) {
				$this->stats['newheight'] = $this->args['maxheight'];
			} else if (isset($this->args['maxwidth'])) {
				// cover odd case where only width is restricted for portrait image
				$this->stats['newwidth'] = $this->args['maxwidth'];
			}
		} else {
			if (isset($this->args['maxwidth'])) {
				$this->stats['newwidth'] = $this->args['maxwidth'];
			} else if (isset($this->args['maxheight'])) {
				// cover odd case where only height is restricted for landscape image
				$this->stats['newheight'] = $this->args['maxheight'];
			}
		}
		// derive unset dimension using restricted one
		if (!isset($this->stats['newwidth'])) {
			$this->stats['newwidth'] = $this->stats['newheight'] * $width / $height;
		}
		if (!isset($this->stats['newheight'])) {
			$this->stats['newheight'] = $this->stats['newwidth'] * $height / $width;
		}
	}


}
