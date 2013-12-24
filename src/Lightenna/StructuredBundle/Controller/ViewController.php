<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

/** These constants are only defined here, though referenced elsewhere **/
define('DEBUG', true);
define('DIR_SEPARATOR', '/');
define('ZIP_SEPARATOR', '/');
define('ARG_SEPARATOR', '~args&');
// define('SUB_REGEX', '/\[([0-9]+)\]/x');
// define('SUB_REGEX', '|\[([0-9]*)\]|i');
define('SUB_REGEX', '/\[(.+)\]/');

class ViewController extends Controller
{
	var $settings;

	public function __construct() {
		$settings_file = self::convertRawToInternalFilename('conf/structured.ini');
		$this->settings = parse_ini_file($settings_file, true);
		// pull in conf.d settings
		if (isset($this->settings['general'])) {
			if (isset($this->settings['general']['confd'])) {
				// read all directory entries
				$confdirname = self::convertRawToInternalFilename($this->settings['general']['confd']);
				// check the directory exists
				if (is_dir($confdirname)) {
					// process settings if found
					$listing = scandir($confdirname);
					self::processListing($confdirname, $listing);
					// parse each .ini file
					foreach ($listing as $entry) {
						if (strtolower($entry->ext) == 'ini') {
							// add to settings
							$subsets = parse_ini_file($confdirname.DIR_SEPARATOR.$entry->name, true);
							$this->settings += $subsets;
						}
					}
				}
			}
		}
		// process settings
		$this->processSettings();
	}

	/**
	 * Process settings array for actions
	 */
	public function processSettings() {
		$this->settings['shares'] = self::findShares($this->settings);
		$attach = array();
		if (is_array($this->settings['shares'])) {
			// build array of attach points
			foreach ($this->settings['shares'] as &$sh) {
				if (isset($sh['enabled']) && ($sh['enabled'] == false)) {
					// ignore disabled shares
					continue;
				}
				// define each unique attach point as an array
				if (!isset($attach[$sh['attach']])) {
					$attach[$sh['attach']] = array();
				}
				// add this shares to that attach point
				$attach[$sh['attach']][] = &$sh;
			}
		}
		$this->settings['attach'] = $attach;
	}

	/**
	 * parse settings array, look for and return shares
	 * @param  Array $arr to search
	 * @todo could insert validation here to check values
	 * @return Array shares
	 */
	static function findShares($arr) {
		$shares = array();
		foreach ($arr as &$entry) {
			if (isset($entry['type']) && ($entry['type'] == 'share')) {
				$shares[] = &$entry;
			}
		}
		return $shares;
	}

	/**
	 * substitute references out of filename
	 * @param  string $filename filename containing references
	 * @return string filename with substitutions
	 */
	public function performFilenameSubstitution($filename) {
		// search string for nth references [1]
		$matches = array();
		if (preg_match_all(SUB_REGEX, $filename, $matches, PREG_OFFSET_CAPTURE) == 1) {
			print_r($matches);

		} 
// START HERE
print($filename);
exit;
		// hunt for attach points from shares
		return $filename;
	}

	/**
	 * Note: all URLs go through this function (or internal version below) to become filenames
	 * @return Filename without trailing slash
	 */
	public function convertRawToFilename($name) {
		$name = rtrim($name, DIR_SEPARATOR);
		// path back up out of symfony
		$symfony_offset = '..'.DIR_SEPARATOR.'..'.DIR_SEPARATOR.'..';
		// return composite path to real root
		$filename = rtrim($_SERVER['DOCUMENT_ROOT'], DIR_SEPARATOR).DIR_SEPARATOR.$symfony_offset.DIR_SEPARATOR.ltrim($name, DIR_SEPARATOR);
		return $this->performFilenameSubstitution($filename);
	}

	/**
	 * @return Filename within structured folder without trailing slash
	 */
	static function convertRawToInternalFilename($name) {
		$name = rtrim($name, DIR_SEPARATOR);
		// path back up out of symfony
		$symfony_offset_to_structured = '..'.DIR_SEPARATOR.'..';
		// return composite path to real root
		return rtrim($_SERVER['DOCUMENT_ROOT'], DIR_SEPARATOR).DIR_SEPARATOR.$symfony_offset_to_structured.DIR_SEPARATOR.ltrim($name, DIR_SEPARATOR);
	}

	/**
	 * @return URL name without trailing slash
	 */
	static function convertRawToUrl($name) {
		return DIR_SEPARATOR.trim($name, DIR_SEPARATOR);
	}

	/**
	 * get file extension from a filename
	 * @param $name full path of file
	 * @return string the extension
	 */
	static function getExtension($name) {
		// find end of filename section (pre-args)
		$end = strpos($name, ARG_SEPARATOR);
		// if no args, use full length of string
		if ($end === false) {
			$end = strlen($name);
		}
		// find position of last .
		$pos = strrpos($name, '.');
		// if not found
		if ($pos === false) {
			return false;
		}
		$len = $end - $pos - 1;
		// strip trailing / if it came from a URL
		if ($name[$pos+1+$len-1] == DIR_SEPARATOR) {
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
		return self::processListing($name, $listing);
	}

	/**
	 * get a conventional directory listing
	 * @param $name full path of directory
	 */
	static function getDirectoryListing($name) {
		// get basic listing
		$listing = scandir($name);
		return self::processListing($name, $listing);
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
			if (is_dir($name.DIR_SEPARATOR.$v)) {
				$obj->{'type'} = 'directory';
			} else {
				$obj->{'ext'} = self::getExtension($v);
				// catch hidden files
				if ($v[0] == '.') {
					$obj->{'hidden'} = true;
				}
				switch(strtolower($obj->{'ext'})) {
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
