import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Trunkline from './trunkline.model.js'

const ML = sequelize.define('ml', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    ml_id: {
        type: DataTypes.STRING(25),
        allowNull: false,
        unique: true,
    },
    ml_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ml_title: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    tline_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: Trunkline,
            key: 'tline_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    path: {
        type: DataTypes.STRING(50),
        allowNull: false
    }
}, {
    tableName: 'ml',
    timestamps: false,
    underscored: true
})

export default ML