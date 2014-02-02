<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class FFMpegHelper
{
	var $cache;
	var $stats;
	var $path_ffmpeg;

	public function __construct($st, $ca, $parentController) {
		$this->stats = $st;
		$this->cache = $ca;
		$this->path_ffmpeg = $parentController::convertRawToInternalFilename('vendor/ffmpeg/bin').'/';
	}

	/**
	 * Use FFmpeg to take a snapshot of part of this video
	 * @param  string $time timecode [HH:MM:SS.MS]
	 * @param  string $outputname name of file to write to
	 * @return string name of file written to, or false on failure
	 */
	public function takeSnapshot($time, $outputname) {
		// escape arguments
		$shell_filename = escapeshellarg($this->stats['file']);
		$shell_output = escapeshellarg($outputname);
		$shell_time = escapeshellarg($time);
		// extract a thumbnail from the video and store in the mediacache
		@shell_exec("{$this->path_ffmpeg}ffmpeg -i {$shell_filename} -ss {$shell_time} -f image2 -vframes 1 {$outputname}");
		// check that an output file was created
		if (!file_exists($outputname)) {
			return false;
		}
		return $outputname;
	}

}
