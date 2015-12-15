<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\Entity\ImageMetadata;

class Rectangle
{

    protected $x1, $y1, $x2, $y2;

    /**
     * Construct either as
     * new Rectangle(x1,y1,x2,y2) or
     * new Rectangle([x1, y2, x2, y2])
     */
    public function __construct($a1 = 0, $b1 = 0, $a2 = 0, $b2 = 0)
    {
        if (is_array($a1)) {
            $this->x1 = $a1[0];
            $this->y1 = $a1[1];
            $this->x2 = $a1[2];
            $this->y2 = $a1[3];
        } else {
            $this->x1 = $a1;
            $this->y1 = $b1;
            $this->x2 = $a2;
            $this->y2 = $b2;
        }
    }

    public function equals($r)
    {
        return $r->equalsValues($this->x1, $this->y1, $this->x2, $this->y2);
    }

    public function equalsValues($a1, $b1, $a2, $b2)
    {
        return (
            $this->x1 == $a1 &&
            $this->y1 == $b1 &&
            $this->x2 == $a2 &&
            $this->y2 == $b2
        );
    }

    /**
     * @param  object $r named rectangle
     * @return boolean true if any part of the named rectangle intersects this rectangle
     */
    public function intersects($r)
    {
        if (
            ($r->getX2() < $this->getX1()) || ($this->getX2() < $r->getX1()) ||
            ($r->getY2() < $this->getY1()) || ($this->getY2() < $r->getY1())
        ) {
            return false;
        }
        return true;
    }

    /**
     * @return boolean true if this named point lies within this rectangle
     */
    public function contains($x, $y)
    {
        if (($x >= $this->x1) && ($y >= $this->y1) && ($x <= $this->x2) && ($y <= $this->y2)) {
            return true;
        }
        return false;
    }

    public function toString()
    {
        return ('x1,y1(' . $this->x1 . ',' . $this->y1 . ') x2,y2(' . $this->x2 . ',' . $this->y2 . ')');
    }

    public function mux($xfac, $yfac)
    {
        $this->x1 = $this->x1 * $xfac;
        $this->x2 = $this->x2 * $xfac;
        $this->y1 = $this->y1 * $yfac;
        $this->y2 = $this->y2 * $yfac;
    }

    //
    // Accessor/mutators
    //

    public function getX()
    {
        return $this->getX1();
    }

    public function getX1()
    {
        return $this->x1;
    }

    public function setX($x)
    {
        $this->setX1($x);
    }

    public function setX1($x)
    {
        $this->x1 = $x;
    }

    public function getY()
    {
        return $this->getY1();
    }

    public function getY1()
    {
        return $this->y1;
    }

    public function setY($y)
    {
        $this->setY1($y);
    }

    public function setY1($y)
    {
        $this->y1 = $y;
    }

    public function getX2()
    {
        return $this->x2;
    }

    public function setX2($x)
    {
        $this->x2 = $x;
    }

    public function getY2()
    {
        return $this->y2;
    }

    public function setY2($y)
    {
        $this->y2 = $y;
    }

    public function getWidth()
    {
        return $this->x2 - $this->x1;
    }

    public function setWidth($w)
    {
        $this->x2 = $this->x1 + $w;
    }

    public function getHeight()
    {
        return $this->y2 - $this->y1;
    }

    public function setHeight($h)
    {
        $this->y2 = $this->y1 + $h;
    }

}
