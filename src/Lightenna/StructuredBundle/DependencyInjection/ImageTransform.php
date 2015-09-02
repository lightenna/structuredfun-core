<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Entity\GenericEntry;

class ImageTransform
{

    protected $args = null;
    protected $output_width = null;
    protected $output_height = null;
    protected $output_ext = null;
    protected $entry = null;
    protected $imgdata = null;

    public function __construct($args, &$imgdata, $entry = null)
    {
        $this->args = $args;
        $this->imgdata = $imgdata;
        if ($entry !== null) {
            // hold on to generic entry reference in favour of metadata reference
            // because the latter changes after deserialisation
            $this->entry = $entry;
            // assume no transform, in case getImageData is called before filtering
            $this->output_width = $this->entry->getMetadata()->getLoadedWidth();
            $this->output_height = $this->entry->getMetadata()->getLoadedHeight();
            $this->output_ext = ($this->entry->hasExt() ? $this->entry->getExt() : 'jpg');
        }
    }

    /**
     * @return image data as a string
     */
    public function getImgdata()
    {
        return $this->imgdata;
    }

    public function getOutputWidth()
    {
        return $this->output_width;
    }

    public function getOutputHeight()
    {
        return $this->output_height;
    }

    /**
     * filter image based on its arguments
     * @return image data as a string
     */
    public function applyFilter()
    {
        // work on the class-wide image data
        $imgdata = $this->imgdata;
        // only filter if there are applicable filters to apply
        if (self::shouldFilterImage($this->args)) {
            // always calculate new image size (at least reads width & height from img)
            $oldimg = imagecreatefromstring($imgdata);
            $this->imageCalcNewSize($oldimg);
            // first [optionally] resize
            if (self::shouldResizeImage($this->args)) {
                $img = $this->resizeImage($oldimg);
                // store image in oldimg for process symmetry
                $oldimg = $img;
            }
            // fetch new imgdata (covering case where we haven't set the ext, e.g. tests)
            $imgdata = self::getImageData($oldimg, $this->output_ext);
            // cache derived image, but don't reread the metadata as
            //   original metadata is lost by imagecreatefromstring() call
            // $this->cacheInterim($imgdata);
            // then [optionally] clip
            if ($this->shouldClipImage($this->args)) {
                if ($oldimg === null) {
                    $oldimg = imagecreatefromstring($imgdata);
                }
                $this->output_width = $this->args->{'clipwidth'};
                $this->output_height = $this->args->{'clipheight'};
                $img = $this->clipImage($oldimg);
                // store image in oldimg for process symmetry
                $oldimg = $img;
            }
            // fetch new imgdata (covering case where we haven't set the ext, e.g. tests)
            $imgdata = self::getImageData($oldimg, $this->output_ext);
            // after we've extracted the image as a string, destroy redundant image resource
            imagedestroy($oldimg);
        }
        // store image data back in class
        $this->imgdata = $imgdata;
        return $this->getImgdata();
    }

    /**
     * @todo This doesn't work because we don't have access to mfr.  This is not a priority.
     */
    private function cacheInterim($imgdata)
    {
        $this->mfr->cache($imgdata, false);
    }

    /**
     * resize image to width/height or both based on args
     * Note: this destroys the old image to avoid memory leaks
     * @param resource $img The image
     * @return resource
     */
    private function resizeImage(&$img)
    {
        // create a new image the correct shape and size
        $newimg = imagecreatetruecolor($this->output_width, $this->output_height);
        imagecopyresampled($newimg, $img, 0, 0, 0, 0, $this->output_width, $this->output_height, $this->entry->getMetadata()->getLoadedWidth(), $this->entry->getMetadata()->getLoadedHeight());
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
    private function clipImage(&$img)
    {
        // create a new image the correct shape and size
        $newimg = imagecreatetruecolor($this->output_width, $this->output_height);
        $sx = imagesx($img) / 2 - $this->output_width / 2;
        $sy = imagesy($img) / 2 - $this->output_height / 2;
        imagecopy($newimg, $img, 0, 0, $sx, $sy, $this->output_width, $this->output_height);
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
     * public for test suite
     */
    public function imageCalcNewSize(&$img)
    {
        // clear old calculations
        $this->output_width = $this->output_height = null;
        // find image dimensions and derive portrait/landscape
        // @refactor ; use $this->entry->getMetadata()->getOrientation()
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
                $this->output_height = $this->args->{'maxheight'};
            } else if (isset($this->args->{'maxlongest'})) {
                // set the height to be maxlongest
                // allow newwidth to be derived
                $this->output_height = $this->args->{'maxlongest'};
            } else if (isset($this->args->{'maxshortest'})) {
                // set the width to be maxshortest
                // allow newheight to be derived
                $this->output_width = $this->args->{'maxshortest'};
            } else if (isset($this->args->{'maxwidth'})) {
                // cover odd portrait case where only width is restricted (maxwidth defined, but maxheight unset)
                $this->output_width = $this->args->{'maxwidth'};
            }
        } else {
            if (isset($this->args->{'maxwidth'})) {
                $this->output_width = $this->args->{'maxwidth'};
            } else if (isset($this->args->{'maxlongest'})) {
                // set the width to be maxlongest
                // allow newheight to be derived
                $this->output_width = $this->args->{'maxlongest'};
            } else if (isset($this->args->{'maxshortest'})) {
                // set the height to be maxshortest
                // allow newwidth to be derived
                $this->output_height = $this->args->{'maxshortest'};
            } else if (isset($this->args->{'maxheight'})) {
                // cover odd landscape case where only height is restricted (maxheight defined, but maxwidth unset)
                $this->output_height = $this->args->{'maxheight'};
            }
        }
        // don't allow image to exceed original at 200%
        $argsactor = 2;
        if (isset($this->output_width) && $this->output_width > $argsactor * $width) {
            $this->output_width = round($argsactor * $height, 1);
        }
        if (isset($this->output_height) && $this->output_height > $argsactor * $width) {
            $this->output_height = round($argsactor * $height, 1);
        }
        // catch case where we haven't restricted either dimension
        if (!isset($this->output_width) && !isset($this->output_height)) {
            $this->output_width = $width;
            $this->output_height = $height;
        } else {
            // derive unset dimension using restricted one
            if (!isset($this->output_width)) {
                $this->output_width = round($this->output_height * $width / $height, 1);
            }
            if (!isset($this->output_height)) {
                $this->output_height = round($this->output_width * $height / $width, 1);
            }
        }
    }

    //
    // STATIC functions
    //

    /**
     * Nasty function to get the image data from an image resource
     */
    static function getImageData(&$img, $type = 'jpg')
    {
        ob_start();
        switch (strtolower($type)) {
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

    /**
     * decide if we're going to need to filter the image
     * @param  array $args list of filter arguments
     * @return boolean true if filtering required
     */
    static function shouldFilterImage($args)
    {
        return (self::shouldResizeImage($args) || self::shouldClipImage($args));
    }

    /**
     * decide if we're going to need to resize the image
     * @param  array $args list of filter arguments
     * @return boolean true if resize required
     */
    static function shouldResizeImage($args)
    {
        return (isset($args->{'maxwidth'}) || isset($args->{'maxheight'}) || isset($args->{'maxlongest'}) || isset($args->{'maxshortest'}));
    }

    /**
     * decide if we're going to need to clip the image
     * @param  array $args list of filter arguments
     * @return boolean true if clipping required
     */
    static function shouldClipImage($args)
    {
        return (isset($args->{'clipwidth'}) || isset($args->{'clipheight'}));
    }

}
