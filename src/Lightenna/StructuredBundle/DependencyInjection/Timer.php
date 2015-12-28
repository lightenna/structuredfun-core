<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class Timer
{

    protected $start;

    public function __construct()
    {
        $this->start = static::getTime();
    }

    public function get() {
        $diff = static::getTime() - $this->start;
        return $diff;
    }

    public function getString() {
        $t = $this->get();
        if ($t < 1000) {
            return round($t, 0).'ms';
        }
        return round($t / 1000, 2).'s';
    }

    static function getTime() {
        return microtime(true) * 1000;
    }

}
