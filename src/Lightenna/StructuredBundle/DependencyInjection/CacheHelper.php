<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class CacheHelper
{
	public function __construct() {
	}

	/**
	 * For now this is based on name-only
	 * @todo incorporate file modified date into hash
	 * @return string A cache key based on the file's metadata
	 */
	static function getKey($stats, $args = null) {
		$cachestring = $stats['file'];
		$cachestring .= self::flattenKeyArgs($args);
		$key = md5($cachestring);
		return $key;
	}

	/**
	 * Check if a given cache item exists in the cache
	 * @param  string $key cache key
	 * @return bool true if present
	 */
	static function exists($key) {
		// START HERE

	}

	/**
	 * Return a given item from the cache
	 * @param  string $key cache key
	 * @return string item
	 */
	static function get($key) {

	}

	/**
	 * Create a string to uniquely identify these image arguments
	 * @param  array $args URL arguments
	 * @return string arguments as a string
	 */
	static function flattenKeyArgs($args) {
		$output = '';
		// if there are no args, they flatten to an empty string
		if (is_null($args)) return '';
		// only certain args should be used in the cache key
		$keys = array('maxwidth','maxheight');
		foreach ($keys as $key) {
			if (isset($args[$key])) {
				$output .= $key . $args[$key];
			}
		}
		return $output;
	}


}
