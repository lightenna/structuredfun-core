<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

define('DEBUG', true);
define('ZIP_SEPARATOR', '~');
define('ARG_SEPARATOR', '~args&');

class ViewController extends Controller
{
	var $settings;

	public function __construct() {
		$settings_file = self::convertRawToFilename('structured/conf/structured.ini');
		$this->settings = parse_ini_file($settings_file);
	}

	/**
	 * @return Filename without trailing slash
	 */
	static function convertRawToFilename($name) {
		$name = rtrim($name, '/');
		// path back up out of symfony
		$symfony_offset = '../../../';
		// return composite path to real root
		return $_SERVER['DOCUMENT_ROOT'].'/'.$symfony_offset.$name;
	}

	/**
	 * @return URL name without trailing slash
	 */
	static function convertRawToUrl($name) {
		return rtrim($name, '/');
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
	 * detect if a path contains a reference to a zip
	 * @param $name full path
	 */
	static function detectZipInPath($name) {
		// break path into component parts
		$zip_pos = strpos($name, '.zip'.ZIP_SEPARATOR);
		return $zip_pos;
	}

	/**
	 * detect if a path contains a reference to a zip
	 * @param $name full path
	 */
	static function getZipBitFromZipPath($name) {
		$zip_pos = self::detectZipInPath($name);
		// break out if we're not in a zip
		if ($zip_pos === false) return false;
		// find path to zip file (first bit) including '.zip'
		$zip_path = substr($name, 0, $zip_pos + 4);
		return $zip_path;
	}

	/**
	 * get the relative filename within the zip archive
	 * @param $name full path
	 * @todo merge with getFileBitFromPath
	 */
	static function getFileBitFromZipPath($name) {
		$zip_pos = self::detectZipInPath($name);
		// break out if we're not in a zip
		if ($zip_pos === false) return false;
		// strip args if present
		$arg_pos = strpos($name, ARG_SEPARATOR);
		if ($arg_pos === false) {
			// find path within zip (after .zip<separator>)
			$zip_path = substr($name, $zip_pos + 5);
		} else {
			$zip_path = substr($name, $zip_pos + 5, $arg_pos - $zip_pos - 5);
		}
		return $zip_path;
	}

	/**
	 * return the file path without any arguments
	 */
	static function getFileBitFromPath($name) {
		// strip args if present
		$arg_pos = strpos($name, ARG_SEPARATOR);
		if ($arg_pos === false) {
			$path = $name;
		} else {
			$path = substr($name, 0, $arg_pos);
		}
		return $path;
	}

	/**
	 * get any arguments that feature on the filename
	 * @param $name full path
	 */
	static function getArgsFromPath($name) {
		$args = array();
		// strip args if present
		$arg_pos = strpos($name, ARG_SEPARATOR);
		if ($arg_pos === false) {
			// no arguments found
		} else {
			$char_split = explode('&', substr($name, $arg_pos + strlen(ARG_SEPARATOR)));
			foreach ($char_split as $char_var) {
				if (strpos($char_var, '=') === false) {
					$args[$char_var] = null;
					continue;
				}
				list($k, $v) = explode('=', $char_var);
				$args[$k] = $v;
			}
		}
		return $args;
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
			if ($name !== null) {
				$obj->{'path'} = $name;
			}
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
				switch(strtolower($obj->{'extension'})) {
					case 'jpeg' :
					case 'jpg' :
					case 'gif' :
						$obj->{'type'} = 'image';
						break;
					case 'mp4' :
					case 'm4v' :
					case 'avi' :
					case 'flv' :
						$obj->{'type'} = 'video';
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
