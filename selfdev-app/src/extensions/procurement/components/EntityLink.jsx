import React from 'react'
import { Link } from 'react-router-dom'
export const EntityLink = ({ to, children, secondary }) => <Link className={secondary ? 'pr-entity-link pr-entity-link--secondary' : 'pr-entity-link'} to={to}>{children}</Link>
