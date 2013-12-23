<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Lightenna\StructuredBundle\DependencyInjection\FFmpegHelper;
use Lightenna\StructuredBundle\DependencyInjection\CacheHelper;

class ImageviewController extends ViewController
{
	// @param Array image metadata array
	private $stats;
	// @param Array URL arguments array
	private $args;

	public function indexAction($rawname)
	{
		$name = self::convertRawToUrl($rawname);
		// build a basic listing object a la file view in $stats[0]
		$us = array($name);
		$this->stats = self::processListing(null, $us);
		// parse args to work out what to return
		$this->args = self::getArgsFromPath($name);
		// convert urlname to fs filename
		$filefull = $this->convertRawToFilename(self::getFileBitFromPath($name));
		// search path for any zip directories
		if (self::detectZipInPath($name) !== false) {
			// convert path to zip to full path to zip
			$zipfull = self::getZipBitFromZipPath($filefull);
			// open up the zip file
			$zip = new \ZipArchive;
			if ($zip->open($zipfull) === true) {
				// work out the filename within the zip
				$fileInZip = self::getFileBitFromZipPath($filefull);
				// build up minimum information about this file
				$this->stats += $zip->statName($fileInZip);
				// include abstract 'file' full name for reference (e.g. caching)...
				$this->stats['file'] = $filefull;
				// ...but we actually use 'filezip' for access
				$this->stats['filezip'] = $zip;
				$this->stats['ext'] = strtolower(self::getExtension($this->stats['name']));
				$this->fetchImage();
				$zip->close();
			}
		} else {
			// check that the file exists
			if (file_exists($filefull)) {
				// pull minimum information about this file
				$this->stats += array(
					'name' => $filefull,
					'file' => $filefull,
					'ext'  => strtolower(self::getExtension($filefull)),
					'size' => filesize($filefull),
					'mtime'=> filemtime($filefull),
				);
				// process the picture
				$this->fetchImage($this->stats, $this->args);
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
	 * fetch a thumbnail image from the file (video/image)
	 */
	public function fetchImage() {
		$listing = $this->stats[0];
		$this->cache = new CacheHelper($this->settings, $this);
		$this->stats['cachekey'] = $this->cache->getKey($this->stats, $this->args);
		// if the image file exists in the cache at the requested size, return it
		if ($this->cache->exists($this->stats['cachekey'])) {
			self::returnImage($this->cache->get($this->stats['cachekey']));
		} else {
			// generate image based on media type
			switch($listing->type) {
				case 'video' :
					// override the extension to return an image
					$this->stats['ext'] = 'jpg';
					// does the full-res image exist in the cache
					$fullres_cachekey = $this->cache->getKey($this->stats, null).'_fullres.'.$this->stats['ext'];
					if ($this->cache->exists($fullres_cachekey)) {
						self::returnImage($this->filterImage($this->cache->get($fullres_cachekey)));
					} else {
						// fetch full-res image
						$ff = new FFmpegHelper($this->stats, $this->cache, $this);
						// update stats array with new location of image in cache
						$returnedFile = $ff->takeSnapshot('00:00:10.0', $this->cache->getFilename($fullres_cachekey));
						// if no image produced (e.g. video corrupted or stored in zip)
						if ($returnedFile === false) {
							$this->returnImage($this->filterImage($this->loadErrorImage()));
						}
						$this->stats['file'] = $returnedFile;
						$this->returnImage($this->loadAndFilterImage());
					}
					break;
				default:
				case 'image' :
					$this->returnImage($this->loadAndFilterImage());
					break;
			}		
		}
	}
	
	/**
	 * Output an image with correct headers
	 * @param string $imgdata Raw image data as a string
	 */
	public function returnImage($imgdata) {
		header("Content-Type: image/" . $this->stats['ext']);		
		header("Content-Length: " . strlen($imgdata));
		echo $imgdata;
	}

	/**
	 * print out an image based on an array of its metadata
	 */
	public function loadAndFilterImage() {
		// load image into buffer
		$imgdata = $this->loadImage();
		// filter based on arguments
		if (isset($this->args['maxwidth']) || isset($this->args['maxheight'])) {
			$imgdata = $this->filterImage($imgdata);
		}
		return $imgdata;
	}

	/**
	 * filter image based on its arguments
	 */
	public function filterImage($imgdata) {
		if (isset($this->args['maxwidth']) || isset($this->args['maxheight'])) {
			// resize the image, depending on type
			$oldimg = imagecreatefromstring($imgdata);
			$this->imageCalcNewSize($oldimg);
			$img = $this->resizeImage($oldimg);
			// fetch new imgdata
			$imgdata = self::getImageData($img);
		}
		return $imgdata;
	}

	/**
	 * load image into a buffer
	 * @return string image as a string
	 **/
	public function loadImage() {
		if (isset($this->stats['filezip'])) {
			return $this->stats['filezip']->getFromName($this->stats['name']);
		} else {
			return file_get_contents($this->stats['file']);
		}		
	}

	/**
	 * Return a nice image showing there was a problem
	 * @return string image as a string
	 */
	public function loadErrorImage() {
		return file_get_contents(self::convertRawToInternalFilename('htdocs/web/chrome/images/fullres/missing_image.jpg'));
	}

	/**
	 * resize image to width/height or both based on args
	 * @param resource $img The image
	 * @return resource 
	 */
	public function resizeImage($img) {
		// create a new image the correct shape and size
		$newimg = imagecreatetruecolor($this->stats['newwidth'], $this->stats['newheight']);
		imagecopyresampled($newimg, $img , 0, 0, 0, 0, $this->stats['newwidth'], $this->stats['newheight'], $this->stats['width'], $this->stats['height']);
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
		$this->stats['width'] = imagesx($img);
		$this->stats['height'] = imagesy($img);
		$portrait = false;
		if ($this->stats['height'] > $this->stats['width']) {
			$portrait = true;
		}
		// catch case where we haven't restricted either dimension
		if (!isset($this->args['maxwidth']) && !isset($this->args['maxheight'])) {
			$this->stats['newwidth'] = $this->stats['width'];
			$this->stats['newheight'] = $this->stats['height'];
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
			$this->stats['newwidth'] = $this->stats['newheight'] * $this->stats['width'] / $this->stats['height'];
		}
		if (!isset($this->stats['newheight'])) {
			$this->stats['newheight'] = $this->stats['newwidth'] * $this->stats['height'] / $this->stats['width'];
		}
	}

	/**
	 * Nasty function to get the image data from an image resource
	 */
	static function getImageData($img) {
		ob_start();
		imagejpeg($img);
		return ob_get_clean();
	}
}
