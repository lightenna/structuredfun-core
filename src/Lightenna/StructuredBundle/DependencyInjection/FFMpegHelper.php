<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class FFmpegHelper
{
	var $cache;
	var $stats;

	public function __construct($st, $ca) {
		$this->stats = $st;
		$this->cache = $ca;
	}

	public function takeSnapshot($time, $outputname) {
		// escape arguments
		$shell_filename = escapeshellarg($this->stats['file']);
		$shell_output = escapeshellarg($outputname);
		$shell_time = escapeshellarg($time);
		// extract a thumbnail from the video and store in the mediacache
		// fmpeg -i $shell_filename -ss $shell_time -f image2 -vframes 1 $outputname.jpg
	}

}
