<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class FileviewController extends Controller
{
	public function indexAction($name)
	{
		// convert urlname to fs filename
		$filename = self::convertUrlToFilename($name);
		// check if file/directory exists
		if (file_exists($filename)) {
			if (is_dir($filename)) {
				$dirlisting = self::getDirectoryListing($filename);
				return $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
					'dirname' => $filename,
					'dirlisting' => $dirlisting)
				);
			}
		} else {
			return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
		}
		// understand what kind of file we're looking at
	}

	static function convertUrlToFilename($name) {
		// path back up out of symfony
		$symfony_offset = '../../../';
		// return composite path to real root
		return $_SERVER['DOCUMENT_ROOT'].'/'.$symfony_offset.$name;
	}

	static function getDirectoryListing($name) {
		// get basic listing
		$listing = scandir($name);
		// prune out irrelevant entries
		foreach ($listing as $k => $v) {
			if ($v == '.' || $v == '..') {
				unset($listing[$k]);
				break;
			}
			// turn array entries into objects
			// START HERE
		}
		return $listing;
	}


}
