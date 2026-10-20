Pod::Spec.new do |s|
  s.name           = 'BackSwipe'
  s.version        = '1.0.0'
  s.summary        = 'Lets a horizontal scroller at its first page hand a right swipe to the back gesture.'
  s.description    = 'RAOTA local module. See RAOTABackSwipe.m.'
  s.author         = 'RAOTA'
  s.homepage       = 'https://github.com/raota'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.source_files   = '**/*.{h,m}'
end
