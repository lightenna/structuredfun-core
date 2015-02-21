<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;

use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\Entity\VideoMetadata;
use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\ImageTransform;

class ImageviewController extends ViewController {
  // @param Array image metadata array, shared object reference with MetadataFileReader
  private $stats = null;

  public function __construct() {
    parent::__construct();
    // initialise stats because may use/test class before indexAction() call
    $this->args = new \stdClass();
    $this->mfr = new CachedMetadataFileReader(null, $this);
    $this->stats = new GenericEntry();
  }

  public function indexAction($rawname, $output = true) {
    $this->populate($rawname);
    // get image and return
    $imgdata = $this->fetchImage();
    // catch test case
    if (!$output) {
      return $imgdata;
    }
    if ($imgdata !== null) {
      // print image to output stream
      $this->returnImage($imgdata);
    }
    else {
      // implied else
      return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
    }
  }

  public function metaAction($rawname, Request $request) {
    $this->populate($rawname);
    // request image from cache (including metadata)
    $imgdata = $this->mfr->getOnlyIfCached();
    // if image not in cache
    if (!$imgdata) {
      // load the image normally to cache
      $imgdata = $this->fetchImage();
      // @todo currently have to re-pull from cache to put metadata in .meta{} subobject
      $imgdata = $this->mfr->getOnlyIfCached();
    }
    // get metadata object (comes with metadata from file)
    $md = $this->mfr->getMetadata();
    // embed metadata within stats object
    $this->stats->setMeta($md);
    // see if we have form data to process
    $form = $md->getForm($this);
    $form->handleRequest($request);
    if ($form->isValid()) {
      // $form data already in $md object
      $md->updateDB();
      // update metadata in original file
      $md->updateOriginal();
      // @todo remove/update dirty cached copies
    }
    // return metadata for this object, encoded as json
    print($this->stats->serialise());
    exit;
  }

  /**
   * Process input and setup local objects
   * @param string $rawname Raw input from URL routing
   */
  public function populate($rawname) {
    try {
      // convert rawname to urlname and filename
      $filename = $this->convertRawToFilename($rawname);
    } catch (\Exception $e) {
      // if there was a problem, return a small transparent image
      $rawname = '/chrome/images/fullres/transparent.png';
      $filename = $this->convertRawToInternalFilename('htdocs/web'.$rawname);
    }
    $name = self::convertRawToUrl($rawname);
    // pull arguments from URL
    $this->args = self::getArgsFromPath($name);
    // get file reader object
    $this->mfr = new CachedMetadataFileReader($filename, $this);
    $this->mfr->processDebugSettings();
    // read metadata
    $listing = $this->mfr->getListing();
    $this->stats = $this->mfr->getStats();
  }
  
  /**
   * @return array stats (metadata) array
   */
  public function getStats() {
    return $this->stats;
  }

  /**
   * fetch a thumbnail image from the file (video/image)
   * - by this point, we've had a cache miss on the thumbnail/specific-resolution request
   */
  public function fetchImage() {
    // generate image based on media type
    switch ($this->stats->getType()) {
      case 'video':
        // override the extension to return an image
        $this->stats->setExt('jpg');
        $imgdata = $this->loadVideoFrame();
        break;
      default:
      case 'image':
        $imgdata = $this->loadImage();
        break;
    }
    // filter based on arguments
    if (ImageTransform::shouldFilterImage($this->args)) {
      $it = new ImageTransform($this->args, $imgdata, $this->mfr->getStats());
      $it->applyFilter();
      $imgdata = $it->getImgdata();
      // cache transformed image
      $this->mfr->cache($imgdata, false);
    }
    return $imgdata;
  }

  private function loadVideoFrame() {
    // calculate position in video
    if (!isset($this->args->{'timecode'})) {
      $this->args->{'timecode'} = DEFAULT_TIMECODE;
    }
    // prepend the cache location
    $key = CachedMetadataFileReader::hash($this->stats->getFile() . FILEARG_SEPARATOR . $this->args->timecode) . '_videofullres' . '.' . 'dat';
    // create mfr in two stages, because we need to point at the image file in the cache
    $localmfr = new CachedMetadataFileReader(null, $this);
    $localmfr->rewrite($localmfr->getFilename($key));
    if ($localmfr->existsInCache()) {
      // pull image from cache
      $imgdata = $localmfr->get();
    }
    else {
      // update stats array with new location of image in cache
      $returnedFile = $this->takeSnapshot($this->args->{'timecode'}, $localmfr->getFilename($key));
      // if no image produced (e.g. video corrupted or stored in zip)
      if ($returnedFile === false) {
        $errorimgdata = $this->loadErrorImage();
        return $errorimgdata;
      }
      // point the local reader at the returned file, then read from it
      $localmfr->rewrite($returnedFile);
      $imgdata = $localmfr->get();
    }
    // pull the metadata from localmfr and store in mfr (for when we write the image out later)
    $this->mfr->setMetadata($localmfr->getMetadata());
    // return the image data
    return $imgdata;
  }


  /**
   * Use FFmpeg to take a snapshot of part of this video
   * It always uses the original filename, not the redirected stats->{file}
   * @param  string $time timecode [HH:MM:SS.MS] or second [123] or frame number [f12345]
   * @param  string $outputname name of file to write to
   * @return string name of file written to, or false on failure
   */
  public function takeSnapshot($time, $outputname) {
    $path_ffmpeg = $this->settings['general']['path_ffmpeg'];
    // escape arguments (minus flags)
    $shell_filename = escapeshellarg($this->stats->getFileOriginal());
    $shell_output = escapeshellarg($outputname);
    $shell_time = escapeshellarg(ltrim($time, 'f'));
    // remove output file if it exists already
    if (file_exists($outputname)) {
      unlink($outputname);      
    }
    // detect what kind of timecode we're using
    if ($time[0] == 'f') {
      $shell_time_phrase = "-filter:v select=\"eq(n\,{$shell_time})\"";
      $time = intval(ltrim($time, 'f'));
    } else {
      $shell_time_phrase = "-ss {$shell_time}";
    }
    // setup command to run ffmpeg and relay output to /dev/null
    $command = "{$path_ffmpeg}ffmpeg -i {$shell_filename} {$shell_time_phrase} -f image2 -vframes 1 {$shell_output} ";
    // 2>&1 >/dev/null
    // print($command."<br />\r\n");
    // extract a thumbnail from the video and store in the mediacache
    @shell_exec($command);
    // check that an output file was created
    if (file_exists($outputname)) {
      // pull metadata from original file
      $command = "{$path_ffmpeg}ffprobe -loglevel error -show_streams {$shell_filename}";
      $ffoutput = @shell_exec($command);
      // store metadata in object
      $vmd = new VideoMetadata(null, $this->stats);
      $vmd->imbue(array(
        'dv_timecode' => $time,
      ));
      $vmd->ingestFFmpegOutput($ffoutput);
      // apply metadata to output file
      $vmd->write($outputname);
    } else {
      return false;
    }
    return $outputname;
  }

  /**
   * Output an image with correct headers
   * @param string $imgdata Raw image data as a string
   */
  private function returnImage($imgdata) {
    if (!headers_sent()) {
      header("Content-Type: image/" . $this->stats->getExt());
      header("Content-Length: " . strlen($imgdata));
    }
    echo $imgdata;
    exit;
  }

  /**
   * load image into a buffer
   * @return string image as a string
   **/
  private function loadImage() {
    return $this->mfr->get();
  }

  /**
   * Return a nice image showing there was a problem
   * @return string image as a string
   */

  public function loadErrorImage() {
    // disable caching
    $this->args->{'nocache'} = true;
    // return error image
    return file_get_contents($this->convertRawToInternalFilename('htdocs/web/chrome/images/fullres/missing_image.jpg'));
  }

}
