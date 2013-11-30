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
				continue;
			}
			// create an object (stdClass is outside of namespace)
			$obj = new \stdClass();
			$obj->{'name'} = $v;
			$obj->{'path'} = $name;
			// assume it's a generic file
			$obj->{'type'} = 'genfile';
			$obj->{'hidden'} = false;
			if (is_dir($name.'/'.$v)) {
				$obj->{'type'} = 'directory';
			} else {
				// find position of last .
				$pos = strrpos($v, '.');
				// if not found
				if ($pos === false) {
					$obj->{'extension'} = null;
				}
				// if hidden file (.something)
				else if ($pos == 0) {
					$obj->{'extension'} = null;
					$obj->{'hidden'} = true;
				}
				else {
					$obj->{'extension'} = substr($v, $pos+1);
					switch($obj->{'extension'}) {
						case 'jpeg' :
						case 'jpg' :
						case 'gif' :
							$obj->{'type'} = 'image';
							break;
					}
				}
			}
			// replace this entry in the array with the object we've just made
			$listing[$k] = $obj;
		}
		return $listing;
	}


}
