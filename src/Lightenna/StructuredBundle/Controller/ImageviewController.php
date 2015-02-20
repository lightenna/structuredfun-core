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
      self::returnImage($imgdata);
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
      // @todo update metadata in original file
      $md->updateOriginal();
      // @todo leave dirty cached copies for now
    }
var_dump($this->stats->serialise());
    // return metadata for this object, encoded as json
    print(json_encode($this->stats));
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
    // read metadata
    $listing = $this->mfr->getListing();
    // file is first element in returned listing array
    $this->stats = reset($listing);
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
        $imgdata = $this->fetchVideoFrame();
        return $this->filterImage($imgdata);
        break;
      default:
      case 'image':
        return $this->loadAndFilterImage();
        break;
    }
  }

  private function fetchVideoFrame() {
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
  public function returnImage($imgdata) {
    if (!headers_sent()) {
      header("Content-Type: image/" . $this->stats->getExt());
      header("Content-Length: " . strlen($imgdata));
    }
    echo $imgdata;
    exit;
  }

  /**
   * print out an image based on an array of its metadata
   */
  public function loadAndFilterImage() {
    // load image into buffer
    $imgdata = $this->loadImage();
    // filter based on arguments
    if ($this->argsSayFilterImage()) {
      $imgdata = $this->filterImage($imgdata);
    }
    return $imgdata;
  }

  /**
   * filter image based on its arguments
   * @param $imgdata image data as a string
   */
  public function filterImage(&$imgdata) {
    if ($this->argsSayFilterImage()) {
      // test image datastream size before trying to process
      if (!FileReader::checkImageDatastream($imgdata)) {
        // destroy massive imgdata string as can't load
        $imgdata = null;
        // return 'not found' image
        $imgdata = $this->loadErrorImage();
      }
      // always calculate new image size (at least reads width & height from img)
      $oldimg = imagecreatefromstring($imgdata);
      $this->imageCalcNewSize($oldimg);
      // first [optionally] resize
      if ($this->argsSayResizeImage()) {
        $img = $this->resizeImage($oldimg);
        // store image in oldimg for process symmetry
        $oldimg = $img;
      }
      // fetch new imgdata (covering case where we haven't set the ext, e.g. tests)
      $imgdata = self::getImageData($oldimg, $this->stats->hasExt() ? $this->stats->getExt() : 'jpg');
      // cache derived image, but don't reread the metadata as 
      //   original metadata is lost by imagecreatefromstring() call
      $this->mfr->cache($imgdata, false);
      // then [optionally] clip
      if ($this->argsSayClipImage()) {
        if ($oldimg === null) {
          $oldimg = imagecreatefromstring($imgdata);
        }
        $this->stats->{'newwidth'} = $this->args->{'clipwidth'};
        $this->stats->{'newheight'} = $this->args->{'clipheight'};
        $img = $this->clipImage($oldimg);
        // store image in oldimg for process symmetry
        $oldimg = $img;
      }
      // fetch new imgdata (covering case where we haven't set the ext, e.g. tests)
      $imgdata = self::getImageData($oldimg, $this->stats->hasExt() ? $this->stats->getExt() : 'jpg');
      // after we've extracted the image as a string, destroy redundant image resource
      imagedestroy($oldimg);
    }
    return $imgdata;
  }

  /**
   * decide if we're going to need to filter the image
   * @return boolean true if filtering required
   */
  public function argsSayFilterImage() {
    return ($this->argsSayResizeImage() || $this->argsSayClipImage());
  }

  /**
   * decide if we're going to need to resize the image
   * @return boolean true if resize required
   */
  public function argsSayResizeImage() {
    return (isset($this->args->{'maxwidth'}) || isset($this->args->{'maxheight'}) || isset($this->args->{'maxlongest'}) || isset($this->args->{'maxshortest'}));
  }

  /**
   * decide if we're going to need to clip the image
   * @return boolean true if clipping required
   */
  public function argsSayClipImage() {
    return (isset($this->args->{'clipwidth'}) || isset($this->args->{'clipheight'}));
  }

  /**
   * load image into a buffer
   * @return string image as a string
   **/
  public function loadImage() {
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

  /**
   * resize image to width/height or both based on args
   * Note: this destroys the old image to avoid memory leaks
   * @param resource $img The image
   * @return resource 
   */

  public function resizeImage(&$img) {
    // create a new image the correct shape and size
    $newimg = imagecreatetruecolor($this->stats->{'newwidth'}, $this->stats->{'newheight'});
    imagecopyresampled($newimg, $img, 0, 0, 0, 0, $this->stats->{'newwidth'}, $this->stats->{'newheight'}, $this->stats->getMeta()->getLoadedWidth(), $this->stats->getMeta()->getLoadedHeight());
    // clean up old image
    imagedestroy($img);
    return $newimg;
  }

  /**
   * clip image to width/height or both based on args
   * Note: this destroys the old image to avoid memory leaks
   * @param resource $img The image
   * @return resource 
   */

  public function clipImage(&$img) {
    // create a new image the correct shape and size
    $newimg = imagecreatetruecolor($this->stats->{'newwidth'}, $this->stats->{'newheight'});
    $sx = imagesx($img) / 2 - $this->stats->{'newwidth'} / 2;
    $sy = imagesy($img) / 2 - $this->stats->{'newheight'} / 2;
    imagecopy($newimg, $img, 0, 0, $sx, $sy, $this->stats->{'newwidth'}, $this->stats->{'newheight'});
    // clean up old image
    imagedestroy($img);
    return $newimg;
  }

  /**
   * use original image and args to decide new image size
   * max(width|height) - set the maximum width & height but constrain proportions
   * maxlongest - set the maximum longest edge and work out shortest
   * maxshortest - set the maximum shortest edge and work out longest
   * clip(width|height) - clip image independently of max(width|height|longest|shortest) settings
   */

  public function imageCalcNewSize(&$img) {
    // clear old calculations
    unset($this->stats->{'newwidth'});
    unset($this->stats->{'newheight'});
    // find image dimensions and derive portrait/landscape
    // @refactor ; use $this->stats->getMeta()->getOrientation()
    $width = imagesx($img);
    $height = imagesy($img);
    $portrait = false;
    if ($height > $width) {
      $portrait = true;
    }
    // resize based on longest edge and args
    // exactly 1 restriction is always set
    if ($portrait) {
      // use either max(width|height) as determinant, but don't set both (hence else if)
      if (isset($this->args->{'maxheight'})) {
        $this->stats->{'newheight'} = $this->args->{'maxheight'};
      }
      else if (isset($this->args->{'maxlongest'})) {
        // set the height to be maxlongest
        // allow newwidth to be derived
        $this->stats->{'newheight'} = $this->args->{'maxlongest'};
      }
      else if (isset($this->args->{'maxshortest'})) {
        // set the width to be maxshortest
        // allow newheight to be derived
        $this->stats->{'newwidth'} = $this->args->{'maxshortest'};
      }
      else if (isset($this->args->{'maxwidth'})) {
        // cover odd portrait case where only width is restricted (maxwidth defined, but maxheight unset)
        $this->stats->{'newwidth'} = $this->args->{'maxwidth'};
      }
    }
    else {
      if (isset($this->args->{'maxwidth'})) {
        $this->stats->{'newwidth'} = $this->args->{'maxwidth'};
      }
      else if (isset($this->args->{'maxlongest'})) {
        // set the width to be maxlongest
        // allow newheight to be derived
        $this->stats->{'newwidth'} = $this->args->{'maxlongest'};
      }
      else if (isset($this->args->{'maxshortest'})) {
        // set the height to be maxshortest
        // allow newwidth to be derived
        $this->stats->{'newheight'} = $this->args->{'maxshortest'};
      }
      else if (isset($this->args->{'maxheight'})) {
        // cover odd landscape case where only height is restricted (maxheight defined, but maxwidth unset)
        $this->stats->{'newheight'} = $this->args->{'maxheight'};
      }
    }
    // don't allow image to exceed original at 200%
    $factor = 2;
    if (isset($this->stats->{'newwidth'}) && $this->stats->{'newwidth'} > $factor * $width) {
      $this->stats->{'newwidth'} = round($factor * $height,1);
    }
    if (isset($this->stats->{'newheight'}) && $this->stats->{'newheight'} > $factor * $width) {
      $this->stats->{'newheight'} = round($factor * $height,1);
    }
    // catch case where we haven't restricted either dimension
    if (!isset($this->stats->{'newwidth'}) && !isset($this->stats->{'newheight'})) {
      $this->stats->{'newwidth'} = $width;
      $this->stats->{'newheight'} = $height;
    }
    else {
      // derive unset dimension using restricted one
      if (!isset($this->stats->{'newwidth'})) {
        $this->stats->{'newwidth'} = round($this->stats->{'newheight'} * $width / $height,1);
      }
      if (!isset($this->stats->{'newheight'})) {
        $this->stats->{'newheight'} = round($this->stats->{'newwidth'} * $height / $width,1);
      }
    }
  }

  /**
   * Nasty function to get the image data from an image resource
   */

  static function getImageData(&$img, $type = 'jpg') {
    ob_start();
    switch(strtolower($type)) {
      case 'jpeg' :
      case 'jpg' :
        imagejpeg($img);
        break;
      case 'png' :
        imagepng($img);
        break;
      case 'gif' :
        imagegif($img);
        break;
    }
    return ob_get_clean();
  }
}
