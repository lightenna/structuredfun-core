<?php

namespace Lightenna\StructuredBundle\Entity;

use Lightenna\StructuredBundle\DependencyInjection\Rectangle;

class EntryLayout
{

    /**
     * Create EntryLayout instance
     */
    public function __construct()
    {

    }

    /**
     * ratio of the normalised dimension:native dimension
     */
    protected $normal_native_ratio = array();

    /**
     * image width normalised within bucket of key
     * e.g. [1] => 1, [2] => 0.6, [3] => 0.32
     */
    protected $normal_width = array();

    /**
     * image height normalised within bucket of key
     */
    protected $normal_height = array();

    /**
     * image x position in canvas (in normalised units where minor axis = 1)
     */
    protected $normal_x = array();

    /**
     * image y position in canvas (in normalised units where minor axis = 1)
     */
    protected $normal_y = array();


    public function hasNormalNativeRatioBD($breadth, $direction)
    {
        return isset($this->normal_native_ratio[$direction . $breadth]);
    }

    public function getNormalNativeRatioBD($breadth, $direction)
    {
        return $this->normal_native_ratio[$direction . $breadth];
    }

    public function setNormalNativeRatioBD($breadth, $direction, $nnr)
    {
        $this->normal_native_ratio[$direction . $breadth] = $nnr;
    }

    public function getNormalNativeRatio()
    {
        return $this->normal_native_ratio;
    }

    public function setNormalNativeRatio($nnarr)
    {
        $this->normal_native_ratio = $nnarr;
    }

    public function getNormalWidth()
    {
        return $this->normal_width;
    }

    public function setNormalWidth($nw)
    {
        $this->normal_width = $nw;
    }

    public function getNormalWidthBD($breadth, $direction)
    {
        return $this->normal_width[$direction . $breadth];
    }

    public function setNormalWidthBD($breadth, $direction, $n)
    {
        $this->normal_width[$direction . $breadth] = $n;
    }

    public function getNormalHeight()
    {
        return $this->normal_height;
    }

    public function setNormalHeight($nh)
    {
        $this->normal_height = $nh;
    }

    public function getNormalHeightBD($breadth, $direction)
    {
        return $this->normal_height[$direction . $breadth];
    }

    public function setNormalHeightBD($breadth, $direction, $n)
    {
        $this->normal_height[$direction . $breadth] = $n;
    }

    public function getNormalRectangle($breadth, $direction)
    {
        return new Rectangle(
            $this->getNormalXBD($breadth, $direction),
            $this->getNormalYBD($breadth, $direction),
            $this->getNormalXBD($breadth, $direction) + $this->getNormalWidthBD($breadth, $direction),
            $this->getNormalYBD($breadth, $direction) + $this->getNormalHeightBD($breadth, $direction)
        );
    }

    public function getNormalX()
    {
        return $this->normal_x;
    }

    public function setNormalX($nx)
    {
        $this->normal_x = $nx;
    }

    public function getNormalXBD($breadth, $direction)
    {
        return $this->normal_x[$direction . $breadth];
    }

    public function setNormalXBD($breadth, $direction, $n)
    {
        $this->normal_x[$direction . $breadth] = $n;
    }

    public function getNormalY()
    {
        return $this->normal_y;
    }

    public function setNormalY($ny)
    {
        $this->normal_y = $ny;
    }

    public function getNormalYBD($breadth, $direction)
    {
        return $this->normal_y[$direction . $breadth];
    }

    public function setNormalYBD($breadth, $direction, $n)
    {
        $this->normal_y[$direction . $breadth] = $n;
    }

    public function getNormalsHTML()
    {
        $html = null;
        foreach ($this->normal_width as $k => $v) {
            $html .= 'data-normal-width-' . $k . '="' . $v . '" ';
        }
        foreach ($this->normal_height as $k => $v) {
            $html .= 'data-normal-height-' . $k . '="' . $v . '" ';
        }
        foreach ($this->normal_x as $k => $v) {
            $html .= 'data-normal-x-' . $k . '="' . $v . '" ';
        }
        foreach ($this->normal_y as $k => $v) {
            $html .= 'data-normal-y-' . $k . '="' . $v . '" ';
        }
        return $html;
    }

    /**
     * @return array list of fields (with getters/setters) that shouldn't be serialized
     */
    static function getIgnoredAttributes()
    {
        return array('ignoredAttributes');
    }

}

