<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class FileReader
{

    // parts of filename
    var $zip_part = null;
    var $file_part = null;

    /**
     * @var $zip_part_ {path|leaf} Null for unset, empty string for set but empty (e.g. '/')
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

    public function __construct($filename)
    {
        $this->parseFilename($filename);
    }

    /**
     * Pull out all the different parts of the filename
     * @param string $filename
     */

    protected function parseFilename($filename)
    {
        $end = self::stripArgsToFilename($filename);
        // parse filename for zip marker
        if (($zip_pos = self::detectZip($filename)) !== false) {
            $this->file_part = substr($filename, 0, $zip_pos);
            // store zip_part without preceding slash
            $this->zip_part = ltrim(substr($filename, $zip_pos, $end - $zip_pos), Constantly::DIR_SEPARATOR_URL);
            list($this->zip_part_path, $this->zip_part_leaf) = $this->splitPathLeaf($this->zip_part);
        } else {
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

    public function isExisting()
    {
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
            foreach ($this->listing as $k => $entry) {
                // we've already stripped the zip_part_path from the listing
                if ($this->zip_part_leaf == $entry->getName()) {
                    return true;
                }
            }
            return false;
        } else {
            // use filesystem to detect presence
            return file_exists($this->file_part);
        }
    }

    /**
     * Test to see if the file entity is a directory
     * @return boolean True if directory, false if file, null if not present
     */

    public function isDirectory()
    {
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
        } else {
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

    public function isIgnorableListingEntry($v)
    {
        // ignore directory references or empty file names
        if ($v == '.' || $v == '..' || $v == '') {
            return true;
        }
        // ignore files or folders that begin '.' or the 'structured' folder or 'fun.lnk'
        if (($v[0] == '.') || ($v == Constantly::FOLDER_NAME) || ($v == Constantly::LINK_NAME)) {
            return true;
        }
        return false;
    }

    /**
     * Return a directory listing
     * Crops and strips the zip_part from the listing items
     * @return array Processed listing
     */
    public function getListing()
    {
        // return listing if we've already generated it
        if (is_array($this->listing)) {
            return $this->listing;
        }
        //
        // Part 1: get listing either using file system directly, or parsing zip
        //
        if ($this->inZip()) {
            $zip = zip_open($this->file_part);
            $listing = array();
            if (is_resource($zip)) {
                while ($zip_entry = zip_read($zip)) {
                    $listing[] = zip_entry_name($zip_entry);
                }
                zip_close($zip);
            } else {
                // if we didn't get a listing back
                print(self::errorMessageZip($zip));
                var_dump($this->file_part);
                exit;
            }
            // if zip_part_leaf is set and has characters
            if (($this->zip_part_leaf !== null) && ($len = strlen($this->zip_part_leaf)) > 0) {
                foreach ($listing as $k => $item) {
                    if ($this->zip_part === $item) {
                        // leave in
                    } else {
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
                        } else {
                            $listing[$k] = $remains;
                        }
                    } else {
                        unset($listing[$k]);
                    }
                }
            }
            // crop downstream [child] zip subfolders, based on output from upstream crop & strip
            foreach ($listing as $k => $item) {
                // if this entry features a slash
                if (($slash_pos = strpos($item, Constantly::DIR_SEPARATOR_URL)) !== false) {
                    // followed by a character (i.e. a filename, not just a slash terminated directory name)
                    if (strlen($item) > ($slash_pos + 1)) {
                        unset($listing[$k]);
                    }
                }
            }
        } else {
            // if it's a directory, scan it
            if (is_dir($this->file_part)) {
                $listing = scandir($this->file_part);
            } // if it's a file, make it up
            else {
                $listing = array(
                    $this->file_part_leaf,
                );
            }
        }
        //
        // Part 2: process listing into array of GenericEntries
        //
        foreach ($listing as $k => $v) {
            if ($this->isIgnorableListingEntry($v)) {
                unset($listing[$k]);
                continue;
            }
            // convert from ISO-8859-1 to UTF8 (php 5 can't cope with illegal chars)
            $v_utf8 = iconv("iso-8859-1", "utf-8", $v);
            // hunt for tell-tale 'PHP just gave up' signs
            if (strpos($v_utf8, '?') !== false) {
                // @todo don't fail silently, log an error
                // var_dump($this->file_part_path.'/'.$v);
                // var_dump(file_exists($this->file_part_path.'/'.$v));
                // exit;
            }
            // create an object
            $entry = new GenericEntry();
            $entry->setName(rtrim($v_utf8, '/'));
            $entry->setNameOriginalCharset($v);
            // $obj->setName(rtrim($v, '/'));
            $entry->setAlias($entry->getName());
            // if listing just a file
            if ($this->file_part_leaf !== null) {
                $entry->setPath($this->file_part_path);
                $entry->setFile($this->file_part_path . Constantly::DIR_SEPARATOR_URL . $entry->getName());
                // store duplicate of full filename (including path within zip) in case we need to rewriteToOriginal
                $entry->setFileOriginal($entry->getFile());
            } // if listing a directory/zip
            else if ($this->file_part !== null) {
                // capture file part
                $entry->setPath($this->file_part);
                $entry->setFile($this->file_part . Constantly::DIR_SEPARATOR_URL . $entry->getName());
                // if we cropped a zip path
                if (($this->zip_part_path !== null) && ($len = strlen($this->zip_part_path)) > 0) {
                    // store cropped bit
                    $entry->setZipBit($this->zip_part_path . Constantly::DIR_SEPARATOR_URL . $entry->getName());
                    // adjust filename to include it
                    $entry->setFile($this->file_part . Constantly::ZIP_SEPARATOR . $entry->getZipBit());
                }
                $entry->setFileOriginal($entry->getFile());
            }
            // assume it's a generic file
            $entry->setType('genfile');
            $entry->setHidden(false);
            if ($this->inZip()) {
                // crude test for zip folders (trailing slash)
                if (substr($v_utf8, -1) == '/') {
                    $entry->setType('directory');
                }
            } else {
                // test using filesystem
                if (is_dir($this->file_part . Constantly::DIR_SEPARATOR_URL . $v_utf8)) {
                    $entry->setType('directory');
                    $sublisting = scandir($this->file_part . Constantly::DIR_SEPARATOR_URL . $v_utf8);
                    // exclude . and .. from sublisting count
                    $entry->setSubfolderCount(count($sublisting) - 2);
                }
            }
            // replace this entry in the array with the object we've just made
            $listing[$k] = $entry;
        }
        // store locally and return
        $this->listing = $listing;
        return $listing;
    }

    /**
     * @return File entry for first item in listing (if directory) or only item (file)
     */
    public function getGenericEntryFromListingHead()
    {
        if ($this->listing === null) {
            $this->getListing();
        }
        return reset($this->listing);
    }

    /**
     * @return string Contents of file
     */
    public function get()
    {
        if ($this->inZip()) {
            $zip = new \ZipArchive;
            $zip->open($this->file_part);
            if ($zip) {
                $imgdata = $zip->getFromName($this->zip_part);
            }
            $zip->close();
            return $imgdata;
        } else {
            return @file_get_contents($this->file_part);
        }
    }

    /**
     * Gets a simple file name for this entity
     * Works on both directories and files
     * @return Full filename
     */
    public function getFilename()
    {
        $filename = $this->file_part;
        return $filename;
    }

    /**
     * Rewrite the current file's path
     */
    public function rewrite($newname)
    {
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
     * carefully strip arguments off a filename but be careful of cache files (.dat)
     * @param $filename to string
     * @return int position of end of string
     */
    static function stripArgsToFilename($filename)
    {
        // end before any arguments at the end of the URL, unless filename finishes .yyy
        if ((($end = strpos($filename, Constantly::ARG_SEPARATOR)) === false) || ($filename[strlen($filename) - 4] == '.')) {
            $end = strlen($filename);
        }
        return $end;
    }

    /**
     * get file extension from a filename
     * @param $name full path of file
     * @return string the extension
     */
    static function getExtension($name)
    {
        // find end of filename section (pre-args)
        $end = self::stripArgsToFilename($name);
        // find position of last .
        $pos = strrpos($name, '.');
        // if not found
        if ($pos === false) {
            return false;
        }
        $len = $end - $pos - 1;
        // strip trailing / if it came from a URL
        if ($name[$pos + 1 + $len - 1] == Constantly::DIR_SEPARATOR_URL) {
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
    static function stripExtension($filename)
    {
        // remove extension and . separator
        $file_without = substr($filename, 0, strlen($filename) - 1 - strlen(self::getExtension($filename)));
        return $file_without;
    }

    /**
     * Detect if a file component is an archive
     */
    static function detectZip($comp)
    {
        $zip_pos = strpos($comp, '.' . Constantly::ZIP_EXTMATCH);
        if ($zip_pos !== false) {
            $zip_pos += strlen(Constantly::ZIP_EXTMATCH) + 1;
        }
        return $zip_pos;
    }

    /**
     * @return [string] return zip error number as a meaningful error message
     */
    static function errorMessageZip($errno)
    {
        // using constant name as a string to make this function PHP4 compatible
        // http://php.net/manual/en/function.zip-open.php
        $zipFileFunctionsErrors = array(
            'ZIPARCHIVE::ER_MULTIDISK' => 'Multi-disk zip archives not supported.',
            'ZIPARCHIVE::ER_RENAME' => 'Renaming temporary file failed.',
            'ZIPARCHIVE::ER_CLOSE' => 'Closing zip archive failed',
            'ZIPARCHIVE::ER_SEEK' => 'Seek error',
            'ZIPARCHIVE::ER_READ' => 'Read error',
            'ZIPARCHIVE::ER_WRITE' => 'Write error',
            'ZIPARCHIVE::ER_CRC' => 'CRC error',
            'ZIPARCHIVE::ER_ZIPCLOSED' => 'Containing zip archive was closed',
            'ZIPARCHIVE::ER_NOENT' => 'No such file.',
            'ZIPARCHIVE::ER_EXISTS' => 'File already exists',
            'ZIPARCHIVE::ER_OPEN' => 'Can\'t open file',
            'ZIPARCHIVE::ER_TMPOPEN' => 'Failure to create temporary file.',
            'ZIPARCHIVE::ER_ZLIB' => 'Zlib error',
            'ZIPARCHIVE::ER_MEMORY' => 'Memory allocation failure',
            'ZIPARCHIVE::ER_CHANGED' => 'Entry has been changed',
            'ZIPARCHIVE::ER_COMPNOTSUPP' => 'Compression method not supported.',
            'ZIPARCHIVE::ER_EOF' => 'Premature EOF',
            'ZIPARCHIVE::ER_INVAL' => 'Invalid argument',
            'ZIPARCHIVE::ER_NOZIP' => 'Not a zip archive',
            'ZIPARCHIVE::ER_INTERNAL' => 'Internal error',
            'ZIPARCHIVE::ER_INCONS' => 'Zip archive inconsistent',
            'ZIPARCHIVE::ER_REMOVE' => 'Can\'t remove file',
            'ZIPARCHIVE::ER_DELETED' => 'Entry has been deleted',
        );
        $errmsg = 'unknown';
        foreach ($zipFileFunctionsErrors as $constName => $errorMessage) {
            if (defined($constName) and constant($constName) === $errno) {
                return 'Zip File Function error: ' . $errorMessage;
            }
        }
        return 'Zip File Function error: unknown';
    }

    /**
     * @return boolean True if the target file is a zip or is in a zip
     */

    public function inZip()
    {
        return ($this->zip_part !== null);
    }

    /**
     * Split a filename into leaf and path
     * @assumption Filenames all contain a ., e.g. .htaccess or file.ext
     * @param string $fullstr Full input filename
     * @return array(string, string) Path and leaf
     */

    public function splitPathLeaf($fullstr)
    {
        $path = $leaf = null;
        // detect the final slash
        if (($slash_pos = strrpos(substr($fullstr, 0), Constantly::DIR_SEPARATOR_URL)) !== false) {
            // then work out if there's a . in the last component
            if (($dot_pos = strrpos($fullstr, '.', $slash_pos)) !== false) {
                // if so split into path and leaf
                $path = substr($fullstr, 0, $slash_pos);
                $leaf = substr($fullstr, $slash_pos + 1);
            } else {
                // no dot, treat whole thing as a path
                $path = $fullstr;
                $leaf = null;
            }
        } else {
            // no slash
            if (($dot_pos = strrpos($fullstr, '.', $slash_pos)) !== false) {
                // treat whole thing as leaf
                $leaf = $fullstr;
                $path = '';
            } else {
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

    static function checkImageDatastream(&$imgdata)
    {
        if (strlen($imgdata) == 0) {
            return false;
        }
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

    static function protectLongFilename($filename)
    {
        if (strlen($filename) > Constantly::DIR_LONGFILENAMEMAX) {
            // find nearest /
            $last_slash_pos = strrpos(substr($filename, 0, Constantly::DIR_LONGFILENAMEMAX), Constantly::DIR_SEPARATOR_URL);
            if ($last_slash_pos === false && false) {
                // do not try to find alias instead, because alias folders are atomic in cache
                $last_slash_pos = strrpos(substr($filename, 0, Constantly::DIR_LONGFILENAMEMAX), Constantly::DIR_SEPARATOR_ALIAS);
            }
            if ($last_slash_pos !== false) {
                $dir = substr($filename, 0, $last_slash_pos);
                // if this directory doesn't exist yet, create it
                if (!file_exists($dir)) {
                    mkdir($dir, 0777, true);
                }
                // use chdir to share the load
                chdir($dir);
                $filename = substr($filename, strlen($dir) + 1);
            }
        }
        if (strlen($filename) > Constantly::DIR_LONGFILENAMEMAX) {
            // @todo throw error or repeat chdir op
        }
        return $filename;
    }

}
