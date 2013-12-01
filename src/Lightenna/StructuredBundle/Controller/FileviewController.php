<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

define('DEBUG', true);

class FileviewController extends Controller
{
	public function indexAction($name)
	{
		// convert urlname to fs filename
		$filename = self::convertUrlToFilename($name);
		if (DEBUG && false) {
			print('name('.$filename.') type('.self::getExtension($filename).') -> '.file_exists($filename));
		}
		// catch zips
		if (self::getExtension($filename) == 'zip') {
			$dirlisting = self::getZipListing(rtrim($filename,'/'));
			return $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
				'dirname' => rtrim($filename,'/'),
				'linkpath' => rtrim($name,'/').'#',
				'dirlisting' => $dirlisting)
			);
		}
		// check if file/directory exists exactly as specified
		if (file_exists($filename)) {
			if (is_dir($filename)) {
				// process straight-forward directory
				$dirlisting = self::getDirectoryListing($filename);
				return $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
					'dirname' => $filename,
					'linkpath' => $name,
					'dirlisting' => $dirlisting)
				);
			} else {
				// process file
				return $this->render('LightennaStructuredBundle:Fileview:file.html.twig', array(
					'filename' => $filename,
				));
			}
		}
		// implied else
		return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
	}

	static function convertUrlToFilename($name) {
		// path back up out of symfony
		$symfony_offset = '../../../';
		// return composite path to real root
		return $_SERVER['DOCUMENT_ROOT'].'/'.$symfony_offset.$name;
	}

	/**
	 * get file extension from a filename
	 * @param $name full path of file
	 * @return string the extension
	 */
	static function getExtension($name) {
		// find position of last .
		$pos = strrpos($name, '.');
		// if not found
		if ($pos === false) {
			return false;
		}
		$len = strlen($name) - $pos - 1;
		// strip trailing / if it came from a URL
		if ($name[$pos+1+$len-1] == '/') {
			$len--;
		}
		// pull out extension
		$ext = substr($name, $pos+1, $len);
		return $ext;
	}

	/**
	 * get a zip listing
	 * @param $name full path of zip file
	 */
	static function getZipListing($name) {
		$zip = zip_open($name);
		$listing = array();
		if ($zip) {
			while ($zip_entry = zip_read($zip)) {
				$listing[] = zip_entry_name($zip_entry);
			}
			zip_close($zip);
		}
		return(self::processListing($name, $listing));
	}

	/**
	 * get a conventional directory listing
	 * @param $name full path of directory
	 */
	static function getDirectoryListing($name) {
		// get basic listing
		$listing = scandir($name);
		return(self::processListing($name, $listing));
	}

	/**
	 * convert a simple listing into an object array
	 * @param $name full path of directory/zip
	 * @param $listing [updated] array of filenames
	 */
	static function processListing($name, &$listing) {
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
				$obj->{'extension'} = self::getExtension($v);
				// catch hidden files
				if ($v[0] == '.') {
					$obj->{'hidden'} = true;
				}
				switch($obj->{'extension'}) {
					case 'jpeg' :
					case 'jpg' :
					case 'gif' :
						$obj->{'type'} = 'image';
						break;
					case 'zip' :
						$obj->{'type'} = 'directory';
						break;
				}
			}
			// replace this entry in the array with the object we've just made
			$listing[$k] = $obj;
		}
		return $listing;
	}


}
