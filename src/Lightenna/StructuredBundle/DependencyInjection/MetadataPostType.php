<?php

namespace Lightenna\StructuredBundle\DependencyInjection;
 
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
 
class MetadataPostType extends AbstractType {

  /**
   * compose form
   */
  public function buildForm( FormBuilderInterface $builder, array $options ) {
    $builder->add('headline', 'text');
    $builder->add('byline', 'text');
    $builder->add('caption', 'textarea');
    $builder->add('keywords', 'text');
    $builder->add('copyright', 'text');
    $builder->add('source', 'text');
  }
 
  function getName() {
    return 'MetadataPostType';
  }
}
