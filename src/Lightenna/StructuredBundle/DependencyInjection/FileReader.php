<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
class FileReader {

  // parts of filename
  var $zip_part = null;
  var $file_part = null;

  /**
   * @var $zip_part_{path|leaf} Null for unset, empty string for set but empty (e.g. '/')
   */
  var $zip_part_path = null;
  var $zip_part_leaf = null;
  var $file_part_path = null;
  var $file_part_leaf = null;

  // file listing if this is a folder
  var $listing = null;

  /**
   * @param string $filename
   * Filenames for files must have dots (e.g. fish.ext) 
   */

  public function __construct($filename) {
    $this->parseFilename($filename);
  }

  /**
   * Pull out all the different parts of the filename
   * @param string $filename
   */

  private function parseFilename($filename) {
    // end before any arguments at the end of the URL
    if (($end = strpos($filename, ARG_SEPARATOR)) === false) {
      $end = strlen($filename);
    }
    // parse filename for zip marker
    if (($zip_pos = self::detectZip($filename)) !== false) {
      $this->file_part = substr($filename, 0, $zip_pos);
      // store zip_part without preceding slash
      $this->zip_part = ltrim(substr($filename, $zip_pos, $end - $zip_pos), DIR_SEPARATOR);
      list($this->zip_part_path, $this->zip_part_leaf) = $this->splitPathLeaf($this->zip_part);
    }
    else {
      $this->file_part = substr($filename, 0, $end);
      list($this->file_part_path, $this->file_part_leaf) = $this->splitPathLeaf($this->file_part);
      // catch situation where we're mistaking a directory for a file leaf
      if ($this->file_part_leaf == '.' || $this->file_part_leaf == '..') {
        $this->file_part_path = $this->file_part_path . $this->file_part_leaf;
        $this->file_part_leaf = null;
      }
      $this->zip_part = $this->zip_part_path = $this->zip_part_leaf = null;
    }
  }

  /**
   * Test to see if the file entity exists
   */

  public function isExisting() {
    if ($this->inZip()) {
      // get the zip's listing (if we don't have it), then scan for file entry
      if (is_null($this->listing)) {
        $this->getListing();
      }
      // if we're not looking for anything inside the zip, [the zip] does exist
      if ($this->zip_part == '') {
        return true;
      }
      // if we're not looking for a file in the zip, assume directory exists
      if ($this->zip_part_leaf == '') {
        return true;
      }
      foreach ($this->listing as $k => $item) {
        // we've already stripped the zip_part_path from the listing
        if ($this->zip_part_leaf == $item->name) {
          return true;
        }
      }
      return false;
    }
    else {
      // use filesystem to detect presence
      return file_exists($this->file_part);
    }
  }

  /**
   * Test to see if the file entity is a directory
   * @return boolean True if directory, false if file, null if not present
   */

  public function isDirectory() {
    if ($this->inZip()) {
      // check it exists
      if (!$this->isExisting()) {
        return null;
      }
      // if it exists, use ultra-simple file test
      if ($this->zip_part_leaf === null) {
        return true;
      }
      return false;
    }
    else {
      // if there's no leaf
      if ($this->file_part_leaf === null) {
        // check the whole file part is a directory
        return is_dir($this->file_part);
      } else {
        // if there is a leaf, it's still possible that it's a directory
        return is_dir($this->file_part);
      }
      return false;
    }
  }

  /**
   * Return a directory listing
   * Crops and strips the zip_part from the listing items
   * @return array Processed listing
   */

  public function getListing() {
    // return listing if we've already generated it
    if (is_array($this->listing)) {
      return $this->listing;
    }
    // get listing either using file system directly, or parsing zip
    if ($this->inZip()) {
      $zip = zip_open($this->file_part);
      $listing = array();
      if ($zip) {
        while ($zip_entry = zip_read($zip)) {
          $listing[] = zip_entry_name($zip_entry);
        }
        zip_close($zip);
      }
      // if zip_part_leaf is set and has characters
      if (($this->zip_part_leaf !== null) && ($len = strlen($this->zip_part_leaf)) > 0) {
        foreach ($listing as $k => $item) {
          if ($this->zip_part === $item) {
            // leave in
          }
          else {
            unset($listing[$k]);
          }
        }
      }
      // if zip_part_path is set and has characters
      if (($this->zip_part_path !== null) && ($len = strlen($this->zip_part_path)) > 0) {
        foreach ($listing as $k => $item) {
          // crop [parent] zip entries based on directory path (zip_part_path)
          if (substr($item, 0, $len) === $this->zip_part_path) {
            // for each valid entry, remove the zip_part_path and slash
            $remains = substr($item, $len + 1);
            if ($remains == false) {
              // dump entry if there's nothing left after stripping
              unset($listing[$k]);
            }
            else {
              $listing[$k] = $remains;
            }
          }
          else {
            unset($listing[$k]);
          }
        }
      }
      // crop downstream [child] zip subfolders, based on output from upstream crop & strip
      foreach ($listing as $k => $item) {
        // if this entry features a slash
        if (($slash_pos = strpos($item, DIR_SEPARATOR)) !== false) {
          // followed by a character (i.e. a filename, not just a slash terminated directory name)
          if (strlen($item) > ($slash_pos + 1)) {
            unset($listing[$k]);
          }
        }
      }
    }
    else {
      // if it's a directory, scan it
      if (is_dir($this->file_part)) {
        $listing = scandir($this->file_part);
      }
      // if it's a file, make it up
      else {
        $listing = array(
          $this->file_part_leaf,
        );
      }
    }
    foreach ($listing as $k => $v) {
      // ignore directory references or empty file names
      if ($v == '.' || $v == '..' || $v == '') {
        unset($listing[$k]);
        continue;
      }
      // ignore files or folders that begin '.' or the FOLDER_NAME ('structured') folder
      if (($v[0] == '.') || ($v == FOLDER_NAME)) {
        unset($listing[$k]);
        continue;
      }
      // convert from ISO-8859-1 to UTF8 (php 5 can't cope with illegal chars)
      $v_utf8 = iconv( "iso-8859-1", "utf-8", $v );
      // hunt for tell-tale 'PHP just gave up' signs
      if (strpos($v_utf8,'?') !== false) {
        // @todo don't fail silently, log an error
        // var_dump($this->file_part_path.'/'.$v);
        // var_dump(file_exists($this->file_part_path.'/'.$v));
        // exit;
      }
      // create an object (stdClass is outside of namespace)
      $obj = new \stdClass();
      $obj->{'name'} = rtrim($v_utf8, '/');
      $obj->{'alias'} = $obj->{'name'};
      // if listing just a file
      if ($this->file_part_leaf !== null) {
        $obj->{'path'} = $this->file_part_path;
        $obj->{'file'} = $this->file_part_path . DIR_SEPARATOR . $obj->{'name'};
      }
      // if listing a directory/zip
      else if ($this->file_part !== null) {
        // capture file part
        $obj->{'path'} = $this->file_part;
        $obj->{'file'} = $this->file_part;
        // if we cropped a zip path
        if (($this->zip_part_path !== null) && ($len = strlen($this->zip_part_path)) > 0) {
          // store cropped bit
          $obj->{'zip_path'} = $this->zip_part_path;
        }
      }
      // assume it's a generic file
      $obj->{'type'} = 'genfile';
      $obj->{'hidden'} = false;
      if ($this->inZip()) {
        // crude test for zip folders (trailing slash)
        if (substr($v_utf8, -1) == '/') {
          $obj->{'type'} = 'directory';
        }
      }
      else {
        // test using filesystem
        if (is_dir($this->file_part . DIR_SEPARATOR . $v_utf8)) {
          $obj->{'type'} = 'directory';
          $sublisting = scandir($this->file_part . DIR_SEPARATOR . $v_utf8);
          // exclude . and .. from sublisting count
          $obj->{'subfolder_count'} = count($sublisting)-2;
        }
      }
      // duplicate file ref incase we redirect
      $obj->{'file_original'} = $obj->{'file'};
      // replace this entry in the array with the object we've just made
      $listing[$k] = $obj;
    }
    // store locally and return
    $this->listing = $listing;
    return $listing;
  }

  /**
   * @return File entry for first item in listing (if directory) or only item (file)
   */
  public function getStats() {
    if ($this->listing === null) {
      $this->getListing();
    }
    return reset($this->listing);
  }

  /**
   * @return string Contents of file
   */
  public function get() {
    if ($this->inZip()) {
      $zip = new \ZipArchive;
      $zip->open($this->file_part);
      if ($zip) {
        $imgdata = $zip->getFromName($this->zip_part);
      }
      $zip->close();
      return $imgdata;
    }
    else {
      return @file_get_contents($this->file_part);
    }
  }

  /**
   * Gets a simple file name for this entity
   * Works on both directories and files
   * @return Full filename
   */
  public function getFilename() {
    $filename = $this->file_part;
    return $filename;
  }
  
  /**
   * Gets a compound file name for a single directory entry
   * Should only be called on directories, never files
   * @param $obj directory entry object
   * @return Full filename reconstituted from directory entry
   */
  public function getFullname($obj) {
    // if obj contains a zip path
    if (isset($obj->{'zip_path'}) && ($obj->zip_path)) {
      $fullname = $obj->file . ZIP_SEPARATOR . $obj->zip_path;
    } else {
      $fullname = $obj->file;
    }
    // if it's a directory or a zip file, append leaf from entry ($obj/stats)
    if ($this->isDirectory() || $this->inZip()) {
      // if obj contains a leaf name, append it
      if (isset($obj->{'name'}) && ($obj->name)) {
        $fullname .= DIR_SEPARATOR . $obj->name;
      }
    }
    return $fullname;
  }

  /**
   * Rewrite the current file's path
   */

  public function rewrite($newname) {
    $this->parseFilename($newname);
    // $this->file_part = $newname;
    return $newname;
  }

  /**
   * ----------------
   * HELPER functions
   * ----------------
   */

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
    if ($name[$pos + 1 + $len - 1] == DIR_SEPARATOR) {
      $len--;
    }
    // pull out extension
    $ext = substr($name, $pos + 1, $len);
    return strtolower($ext);
  }

  /**
   * @param $name full path of file
   * @return string filename without extension
   */
  static function stripExtension($filename) {
    // remove extension and . separator
    $file_without = substr($filename, 0, strlen($filename) - 1 - strlen(self::getExtension($filename)));
    return $file_without;
  }

  /**
   * Detect if a file component is an archive 
   */

  static function detectZip($comp) {
    $zip_pos = strpos($comp, '.' . ZIP_EXTMATCH);
    if ($zip_pos !== false) {
      $zip_pos += strlen(ZIP_EXTMATCH) + 1;
    }
    return $zip_pos;
  }

  /**
   * @return boolean True if the target file is a zip or is in a zip
   */

  public function inZip() {
    return ($this->zip_part !== null);
  }

  /**
   * Split a filename into leaf and path
   * @assumption Filenames all contain a ., e.g. .htaccess or file.ext
   * @param string $fullstr Full input filename
   * @return array(string, string) Path and leaf
   */

  public function splitPathLeaf($fullstr) {
    $path = $leaf = null;
    // detect the final slash
    if (($slash_pos = strrpos(substr($fullstr, 0), DIR_SEPARATOR)) !== false) {
      // then work out if there's a . in the last component
      if (($dot_pos = strrpos($fullstr, '.', $slash_pos)) !== false) {
        // if so split into path and leaf
        $path = substr($fullstr, 0, $slash_pos);
        $leaf = substr($fullstr, $slash_pos + 1);
      }
      else {
        // no dot, treat whole thing as a path
        $path = $fullstr;
        $leaf = null;
      }
    }
    else {
      // no slash
      if (($dot_pos = strrpos($fullstr, '.', $slash_pos)) !== false) {
        // treat whole thing as leaf
        $leaf = $fullstr;
        $path = '';
      }
      else {
        // no dot, treat whole thing as path
        $leaf = null;
        $path = $fullstr;
      }
    }
    return array(
      $path,
      $leaf
    );
  }

  /**
   * Guess if we're going to have enough memory to load the image
   *  can't test length because it could be highly compressed/compressible
   *  try catch doesn't throw an exception
   *  set_error_handler not fired in time for fatal exception
   * @param string $imgdata
   * @return boolean True if we can load the image
   */

  static function checkImageDatastream(&$imgdata) {
    // can't use getimagesizefromstring as php > 5.4.0, so redirect via file wrapper
    $uri = 'data://application/octet-stream;base64,' . base64_encode($imgdata);
    $mdata = getimagesize($uri);
    // calculate image size in megapixels
    $mp = $mdata[0] * $mdata[1];
    // get memory limit (MB)
    $mlim = intval(ini_get('memory_limit'));
    // cut-offs: 128MB is about 24MP, 256 about 49MP, 512 about 100MP
    // absolute limit is about 0.194
    $cutoff = 0.19 * $mlim * 1000 * 1000;
    if ($mp > $cutoff) {
      return false;
    }
    return true;
  }

}
