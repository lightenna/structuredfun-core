<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
class FileReader {
  
  // parts of filename
  var $zip_part = null;
  var $file_part = null;

  // file listing if this is a folder
  var $listing = null;

  public function __construct($filename) {
    // parse filename for zip marker
    if (($zip_pos = self::detectZip($filename)) !== false) {
      $this->file_part = substr($filename, 0, $zip_pos);
      // store zip_part without preceding or trailing slash
      $this->zip_part = ltrim(substr($filename, $zip_pos), DIR_SEPARATOR);
    }
    else {
      $this->file_part = $filename;
    }
  }

  /**
   * Test to see if the file entity exists
   */

  public function isExisting() {
    if ($this->inZip()) {
      // get the zip's listing, then scan for file entry
      $this->getListing();
      foreach($this->listing as $k => $item) {
        // PROBLEM: we've already stripped the
        // @todo START HERE
        // split zip_part into zip_directory_part and zip_file_part
        // make getListing crop & strip against the directory part 
        //  + good for all kinds of things
        // might be hard to tell the difference between file and directory
      }
    } else {
      // use filesystem to detect presence
      return file_exists($this->file_part);
    }
  }

  /**
   * Test to see if the file entity is a directory
   */

  public function isDirectory() {

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
      // if zip_part is set and has characters
      if (($this->zip_part !== null) && ($len = strlen($this->zip_part)) > 0) {
        foreach($listing as $k => $item) {
          // crop zip entries based on directory path (zip_part)
          if (!(substr($item, 0, $len) === $this->zip_part)) {
            unset($listing[$k]);
          }
          // remove entry for the directory itself too
          else if (($item === $this->zip_part) || ($item === ($this->zip_part.DIR_SEPARATOR))) {
            unset($listing[$k]);
          }
          // finally for each valid entry, remove the zip part and slash
          else {
            $listing[$k] = substr($item, $len+1);
          }
        }
      }
    }
    else {
      $listing = scandir($this->file_part);
    }
    foreach ($listing as $k => $v) {
      if ($v == '.' || $v == '..') {
        unset($listing[$k]);
        continue;
      }
      // create an object (stdClass is outside of namespace)
      $obj = new \stdClass();
      $obj->{'name'} = $v;
      if ($this->file_part !== null) {
        $obj->{'path'} = $this->file_part;
      }
      // assume it's a generic file
      $obj->{'type'} = 'genfile';
      $obj->{'hidden'} = false;
      if (is_dir($this->file_part . DIR_SEPARATOR . $v)) {
        $obj->{'type'} = 'directory';
      }
      // replace this entry in the array with the object we've just made
      $listing[$k] = $obj;
    }
    // store locally and return
    $this->listing = $listing;
    return $listing;
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
    return $ext;
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

}
