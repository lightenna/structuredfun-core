<?php

namespace Lightenna\StructuredBundle\Controller;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Lightenna\StructuredBundle\DependencyInjection\FFmpegHelper;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

class ImageviewController extends ViewController {
  // @param Array image metadata array
  private $stats = null;

  public function __construct() {
    parent::__construct();
    // initialise stats because may use/test class before indexAction() call
    $this->stats = new \stdClass();
    $this->args = array();
  }

  public function indexAction($rawname, $output = true) {
    // convert rawname to urlname and filename
    $filename = $this->convertRawToFilename($rawname);
    $name = self::convertRawToUrl($rawname);
    // get file reader object
    $this->mfr = new CachedMetadataFileReader($filename, $this);
    // read metadata
    $listing = $this->mfr->getListing();
    // file is first element in returned listing array
    $this->stats = reset($listing);
    $this->args = self::getArgsFromPath($name);
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
    switch ($this->stats->type) {
      case 'video':
      // override the extension to return an image
        $this->stats->ext = 'jpg';
        $key = CachedMetadataFileReader::hash($this->stats->file) . '_videofullres' . '.' . $this->stats->ext;
        $localmfr = new CachedMetadataFileReader($key, $this);
        if ($localmfr->isCached()) {
          // just filter the image
          return $this->filterImage($this->get($key));
        }
        else {
          // update stats array with new location of image in cache
          $returnedFile = $this->takeSnapshot('00:00:10.0', $localmfr->getFilename($key));
          // if no image produced (e.g. video corrupted or stored in zip)
          if ($returnedFile === false) {
print('returnedFile is false');
exit;
            $errorimgdata = $this->loadErrorImage();
            return $this->filterImage($errorimgdata);
          }
          $this->stats->{'file'} = $returnedFile;
print('returning proper image');
exit;
          return $this->loadAndFilterImage();
        }
        break;
      default:
      case 'image':
        return $this->loadAndFilterImage();
        break;
    }
  }

  /**
   * Use FFmpeg to take a snapshot of part of this video
   * It always uses the original filename, not the redirected stats->{file}
   * @param  string $time timecode [HH:MM:SS.MS]
   * @param  string $outputname name of file to write to
   * @return string name of file written to, or false on failure
   */

  public function takeSnapshot($time, $outputname) {
    $path_ffmpeg = $this->settings['general']['path_ffmpeg'];
    // escape arguments
    $shell_filename = escapeshellarg($this->stats->file_original);
    $shell_output = escapeshellarg($outputname);
    $shell_time = escapeshellarg($time);
    // setup command to run ffmpeg and relay output to /dev/null
    $command = "{$path_ffmpeg}ffmpeg -i {$shell_filename} -ss {$shell_time} -f image2 -vframes 1 {$shell_output} 2>&1 > /dev/null";
print($command."<br />\r\n");
    // extract a thumbnail from the video and store in the mediacache
    @shell_exec($command);
    // check that an output file was created
print($outputname);
var_dump(file_exists($outputname));
exit;
    if (!file_exists($outputname)) {
      return false;
    }
    return $outputname;
  }
  
  /**
   * Output an image with correct headers
   * @param string $imgdata Raw image data as a string
   */

  public function returnImage($imgdata) {
    header("Content-Type: image/" . $this->stats->{'ext'});
    header("Content-Length: " . strlen($imgdata));
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
      if (!$this->checkImageDatastream($imgdata)) {
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
      // then [optionally] clip
      if ($this->argsSayClipImage()) {
        if ($oldimg === null) {
          $oldimg = imagecreatefromstring($imgdata);
        }
        $this->stats->{'newwidth'} = $this->args['clipwidth'];
        $this->stats->{'newheight'} = $this->args['clipheight'];
        $img = $this->clipImage($oldimg);
        // store image in oldimg for process symmetry
        $oldimg = $img;
      }
      // fetch new imgdata
      $imgdata = self::getImageData($oldimg);
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
    return (isset($this->args['maxwidth']) || isset($this->args['maxheight']) || isset($this->args['maxlongest']) || isset($this->args['maxshortest']));
  }

  /**
   * decide if we're going to need to clip the image
   * @return boolean true if clipping required
   */

  public function argsSayClipImage() {
    return (isset($this->args['clipwidth']) || isset($this->args['clipheight']));
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
    imagecopyresampled($newimg, $img, 0, 0, 0, 0, $this->stats->{'newwidth'}, $this->stats->{'newheight'}, $this->stats->{'width'}, $this->stats->{'height'});
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
    // find image orientation
    $this->stats->{'width'} = imagesx($img);
    $this->stats->{'height'} = imagesy($img);
    $portrait = false;
    if ($this->stats->{'height'} > $this->stats->{'width'}) {
      $portrait = true;
    }
    // resize based on longest edge and args
    // exactly 1 restriction is always set
    if ($portrait) {
      // use either max(width|height) as determinant, but don't set both (hence else if)
      if (isset($this->args['maxheight'])) {
        $this->stats->{'newheight'} = $this->args['maxheight'];
      }
      else if (isset($this->args['maxlongest'])) {
        // set the height to be maxlongest
        // allow newwidth to be derived
        $this->stats->{'newheight'} = $this->args['maxlongest'];
      }
      else if (isset($this->args['maxshortest'])) {
        // set the width to be maxshortest
        // allow newheight to be derived
        $this->stats->{'newwidth'} = $this->args['maxshortest'];
      }
      else if (isset($this->args['maxwidth'])) {
        // cover odd portrait case where only width is restricted (maxwidth defined, but maxheight unset)
        $this->stats->{'newwidth'} = $this->args['maxwidth'];
      }
    }
    else {
      if (isset($this->args['maxwidth'])) {
        $this->stats->{'newwidth'} = $this->args['maxwidth'];
      }
      else if (isset($this->args['maxlongest'])) {
        // set the width to be maxlongest
        // allow newheight to be derived
        $this->stats->{'newwidth'} = $this->args['maxlongest'];
      }
      else if (isset($this->args['maxshortest'])) {
        // set the height to be maxshortest
        // allow newwidth to be derived
        $this->stats->{'newheight'} = $this->args['maxshortest'];
      }
      else if (isset($this->args['maxheight'])) {
        // cover odd landscape case where only height is restricted (maxheight defined, but maxwidth unset)
        $this->stats->{'newheight'} = $this->args['maxheight'];
      }
    }
    // don't allow image to exceed original at 200%
    $factor = 2;
    if (isset($this->stats->{'newwidth'}) && $this->stats->{'newwidth'} > $factor * $this->stats->{'width'}) {
      $this->stats->{'newwidth'} = $factor * $this->stats->{'height'};
    }
    if (isset($this->stats->{'newheight'}) && $this->stats->{'newheight'} > $factor * $this->stats->{'width'}) {
      $this->stats->{'newheight'} = $factor * $this->stats->{'height'};
    }
    // catch case where we haven't restricted either dimension
    if (!isset($this->stats->{'newwidth'}) && !isset($this->stats->{'newheight'})) {
      $this->stats->{'newwidth'} = $this->stats->{'width'};
      $this->stats->{'newheight'} = $this->stats->{'height'};
    }
    else {
      // derive unset dimension using restricted one
      if (!isset($this->stats->{'newwidth'})) {
        $this->stats->{'newwidth'} = $this->stats->{'newheight'} * $this->stats->{'width'} / $this->stats->{'height'};
      }
      if (!isset($this->stats->{'newheight'})) {
        $this->stats->{'newheight'} = $this->stats->{'newwidth'} * $this->stats->{'height'} / $this->stats->{'width'};
      }
    }
  }

  /**
   * Guess if we're going to have enough memory to load the image
   *  can't test length because it could be highly compressed/compressible
   *  try catch doesn't throw an exception
   *  set_error_handler not fired in time for fatal exception
   * @param string $imgdata
   * @return boolean True if we can load the image
   */

  public function checkImageDatastream(&$imgdata) {
    // can't use getimagesizefromstring as php > 5.4.0, so redirect via file wrapper
    $uri = 'data://application/octet-stream;base64,' . base64_encode($imgdata);
    $mdata = getimagesize($uri);
    // calculate image size in megapixels
    $mp = $mdata[0] * $mdata[1];
    // get memory limit (MB)
    $mlim = intval(ini_get('memory_limit'));
    if ($mlim <= 128) {
      // 24MP cut-off
      if ($mp > 24 * 1000 * 1000) {
        return false;
      }
    }
    else if ($mlim <= 256) {
      // 50MP cut-off
      if ($mp > 50 * 1000 * 1000) {
        return false;
      }

    }
    else if ($mlim <= 512) {
      // 100MP cut-off
      if ($mp > 100 * 1000 * 1000) {
        return false;
      }
    }
    return true;
  }

  /**
   * Nasty function to get the image data from an image resource
   */

  static function getImageData(&$img) {
    ob_start();
    imagejpeg($img);
    return ob_get_clean();
  }
}
