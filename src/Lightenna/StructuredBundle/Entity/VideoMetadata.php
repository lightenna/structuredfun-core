<?php

namespace Lightenna\StructuredBundle\Entity;
use Doctrine\ORM\Mapping as ORM;
use MyProject\Proxies\__CG__\OtherProject\Proxies\__CG__\stdClass;

/**
 * VideoMetadata model
 * @ORM\Entity
 * @ORM\Table(name="video")
 * @IgnoreAnnotation("fn")
 */
class VideoMetadata extends ImageMetadata {
  /**
   * Definitions and notes
   *   scope: only fields defined here get unserialised back from files
   */

  //
  // Fields
  //

  // only fields defined here get unserialised back from files
  // derived or set video fields
  public $dv_framecount = null, $dv_framerate = null, $dv_timecode = null;

  // store as string
  public $video_width, $video_height;
  public $video_r_frame_rate, $video_avg_frame_rate, $audio_r_frame_rate, $audio_avg_frame_rate;
  // also stored as divisor integers
  public $video_r_frame_rate_int, $video_avg_frame_rate_int, $audio_r_frame_rate_int, $audio_avg_frame_rate_int;

  // stored as integers
  public $video_duration_ts, $video_start_pts, $video_bit_rate, $video_nb_frames;
  public $audio_duration_ts, $audio_start_pts, $audio_bit_rate, $audio_nb_frames;
  public $audio_sample_rate, $audio_channels, $audio_bits_per_sample;

  // store as float
  public $video_duration, $video_start_time, $audio_duration, $audio_start_time;

  // store as string
  public $video_codec_name, $video_codec_long_name, $video_profile, $video_codec_type, $video_codec_time_base, $video_codec_tag_string, $video_codec_tag, $video_sample_aspect_ratio, $video_display_aspect_ratio, $video_pix_fmt, $video_level, $video_time_base;
  public $audio_codec_name, $audio_codec_long_name, $audio_profile, $audio_codec_type, $audio_codec_time_base, $audio_codec_tag_string, $audio_codec_tag,                                                          $audio_sample_fmt,            $audio_time_base;

  /**
   * @param  string $ffoutput Raw newline-separated list of video metadata
   * @todo  write a proper parser for stream markers
   */
  public function ingestFFmpegOutput($ffoutput) {
    $stream = 'media_unset';
    // parse output into name:value pairs
    foreach(explode("\n", $ffoutput) as $arraykey => $line) {
      $eqpos = strpos($line, '=');
      if ($eqpos !== false) {
        // watch for stream markers
        $name_raw = substr($line, 0, $eqpos);
        $value_raw = substr($line, $eqpos+1);
        if ($name_raw == 'index') {
          if ($value_raw == '0') {
            $stream = 'video';
          } else if ($value_raw == '1') {
            $stream = 'audio';
          } else {
            $stream = 'media_other';
          }
        } else {
          $name = $stream . '_' . $name_raw;
          switch($name) {
            // process some fields
            case 'video_width':
              $this->{$name} = $this->width = $this->loaded_width = intval($value_raw);
              break;
            case 'video_height':
              $this->{$name} = $this->height = $this->loaded_height = intval($value_raw);
              break;

            // store as string, but also as int
            case 'video_r_frame_rate' :
            case 'video_avg_frame_rate' :
            case 'audio_r_frame_rate' :
            case 'audio_avg_frame_rate':
              $this->{$name} = $value_raw;
              $value_raw_array = explode('/', $value_raw, 2);
              $this->{$name.'_int'} = intval($value_raw_array[0]);
              break;

            // store as int
            case 'video_duration_ts':
            case 'video_start_pts':
            case 'video_bit_rate':
            case 'video_nb_frames':
            case 'audio_duration_ts':
            case 'audio_start_pts':
            case 'audio_bit_rate':
            case 'audio_nb_frames':
            case 'audio_sample_rate':
            case 'audio_channels':
            case 'audio_bits_per_sample':
              $this->{$name} = intval($value_raw);
              break;

            // store as float
            case 'video_duration':
            case 'video_start_time':
            case 'audio_duration':
            case 'audio_start_time':
              $this->{$name} = floatval($value_raw);
              break;

            // store as string
            case 'video_codec_name':
            case 'video_codec_long_name':
            case 'video_profile':
            case 'video_codec_type':
            case 'video_codec_time_base':
            case 'video_codec_tag_string':
            case 'video_codec_tag':
            case 'video_sample_aspect_ratio':
            case 'video_display_aspect_ratio':
            case 'video_pix_fmt':
            case 'video_level':
            case 'video_time_base':
              $this->{$name} = $value_raw;
              break;

            // store as string
            case 'audio_codec_name':
            case 'audio_codec_long_name':
            case 'audio_profile':
            case 'audio_codec_type':
            case 'audio_codec_time_base':
            case 'audio_codec_tag_string':
            case 'audio_codec_tag':
            case 'audio_sample_fmt':
            case 'audio_time_base':
              $this->{$name} = $value_raw;
              break;

            // ignore some fields
            default:
              break;
          }
        }
      }
    }
    // post process
    if (isset($this->{'loaded_width'})) {
      $this->calcRatio();
    }
    $this->dv_framecount = $this->{'video_duration_ts'};
    // fallback to always get framerate
    if (isset($this->{'video_r_frame_rate_int'})) {
      $this->dv_framerate = $this->{'video_r_frame_rate_int'};      
    } else if (isset($this->{'video_avg_frame_rate_int'})) {
      $this->dv_framerate = $this->{'video_avg_frame_rate_int'};
    } else {
      $this->dv_framerate = $dv_framecount / $this->{'video_duration'};
    }
  }

}
