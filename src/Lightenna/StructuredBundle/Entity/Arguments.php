<?php

namespace Lightenna\StructuredBundle\Entity;

use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class Arguments
{

    //
    // Fields
    //

    // @todo change these out for protected
    public $timecode = null;
    public $maxwidth = null;
    public $maxheight = null;
    public $clipwidth = null;
    public $clipheight = null;
    public $maintain_ratio = true;

    public function __construct($w = null, $h = null)
    {
        if ($w !== null) {
            $this->maxwidth = $w;
        }
        if ($h !== null) {
            $this->maxheight = $h;
        }
    }

    public function getArgString() {
        $separator = '~TEMPSEP~';
        $argstr = $separator . 'full' . $separator;
        // always tend to put ! back into URLs
        if ($this->maintain_ratio) {
            $argstr .= '!';
        }
        if ($this->hasMaxWidth()) {
            $argstr .= '' . $this->getMaxWidth();
        }
        $argstr .= ',';
        if ($this->hasMaxHeight()) {
            $argstr .= '' . $this->getMaxHeight();
        }
        $argstr .= $separator . '0' . $separator . 'native.jpg';
        return $argstr;
    }

    public function parseArgs($region = 'full', $size = 'full') {
        if ($size != 'full') {
            $start = 0;
            if ($size[$start] == '!') {
                // skip ! when pulling numbers
                $start = 1;
            } else {
                $this->maintain_ratio = false;
            }
            $comma_pos = strpos($size, ',', $start);
            // if we find a comma and it's beyond a number
            if ($comma_pos !== false && ($comma_pos > $start+1)) {
                $this->maxwidth = intval(substr($size, $start, $comma_pos - $start));
            }
            // if we find a comma and it's got characters after it
            if ($comma_pos !== false && (strlen($size) > $comma_pos + 1)) {
                $this->maxheight = intval(substr($size, $comma_pos + 1));
            }
        }
    }

    /**
     * Merge in another instance of this class
     * @param $other Another instance of Arguments
     */
    public function mergeArgs($other){
        if ($other->hasMaxWidth()) {
            $this->setMaxWidth($other->getMaxWidth());
        }
    }

    public function mergeArgsFromPath($name){
        // strip args if present
        $arg_pos = strpos($name, Constantly::ARG_SEPARATOR);
        if ($arg_pos === false) {
            // no arguments found
        } else {
            $char_split = explode('&', substr($name, $arg_pos + strlen(Constantly::ARG_SEPARATOR)));
            foreach ($char_split as $char_var) {
                if ($char_var == '') {
                    continue;
                }
                if (strpos($char_var, '=') === false) {
                    $this->{$char_var} = null;
                    continue;
                }
                list($k, $v) = explode('=', $char_var);
                $this->{$k} = $v;
            }
        }
    }

    public function hasMaxWidth() {
        return ($this->maxwidth !== null);
    }

    public function getMaxWidth() {
        return $this->maxwidth;
    }

    public function setMaxWidth($w) {
        $this->maxwidth = $w;
    }

    public function hasMaxHeight() {
        return ($this->maxheight !== null);
    }

    public function getMaxHeight() {
        return $this->maxheight;
    }

    public function setMaxHeight($h) {
        $this->maxheight = $h;
    }

    /**
     * get any arguments that feature on the filename
     * @param $name full path
     * @return object
     */

    static function getArgsFromPath($name)
    {
        $args = new Arguments();
        $args->mergeArgsFromPath($name);
        return $args;
    }

}